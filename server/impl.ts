import { ArcadePhysics } from "arcade-physics";
import { Body } from "arcade-physics/lib/physics/arcade/Body";

import { Methods, Context } from "./.hathora/methods";
import { Response } from "../api/base";
import {
  XDirection,
  YDirection,
  GameState,
  UserId,
  IInitializeRequest,
  IJoinGameRequest,
  ISetDirectionRequest,
} from "../api/types";

type InternalPlayer = {
  id: UserId;
  body: Body;
  xDirection: XDirection;
  yDirection: YDirection;
};
type InternalState = {
  physics: ArcadePhysics;
  players: InternalPlayer[];
};

export class Impl implements Methods<InternalState> {
  initialize(ctx: Context, request: IInitializeRequest): InternalState {
    return {
      physics: new ArcadePhysics({
        sys: {
          game: { config: {} },
          settings: { physics: { gravity: { y: 200 } } },
          scale: { width: 800, height: 600 },
        },
      }),
      players: [],
    };
  }
  joinGame(state: InternalState, userId: UserId, ctx: Context, request: IJoinGameRequest): Response {
    if (state.players.some((player) => player.id === userId)) {
      return Response.error("Already joined");
    }
    const playerBody = state.physics.add.body(0, 0, 32, 32);
    playerBody.pushable = false;
    // @ts-ignore
    playerBody.setCollideWorldBounds(true);
    state.players.forEach((player) => state.physics.add.collider(playerBody, player.body));
    state.players.push({
      id: userId,
      body: playerBody,
      xDirection: XDirection.NONE,
      yDirection: YDirection.NONE,
    });
    return Response.ok();
  }
  setDirection(state: InternalState, userId: UserId, ctx: Context, request: ISetDirectionRequest): Response {
    const player = state.players.find((player) => player.id === userId);
    if (player === undefined) {
      return Response.error("Not joined");
    }
    player.xDirection = request.horizontal;
    player.yDirection = request.vertical;
    return Response.ok();
  }
  getUserState(state: InternalState, userId: UserId): GameState {
    return {
      players: state.players.map((player) => {
        const xVelocity = player.body.velocity.x;
        const yVelocity = player.body.velocity.y;
        return {
          id: player.id,
          x: player.body.x,
          y: player.body.y,
          xDirection: xVelocity < 0 ? XDirection.LEFT : xVelocity > 0 ? XDirection.RIGHT : XDirection.NONE,
          yDirection: yVelocity < 0 ? YDirection.UP : yVelocity > 0 ? YDirection.DOWN : YDirection.NONE,
        };
      }),
    };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): void {
    state.players.forEach((player) => {
      if (player.xDirection === XDirection.LEFT && !player.body.blocked.left) {
        player.body.setVelocityX(-200);
      } else if (player.xDirection === XDirection.RIGHT && !player.body.blocked.right) {
        player.body.setVelocityX(200);
      } else if (player.xDirection === XDirection.NONE) {
        player.body.setVelocityX(0);
      }
      if (player.yDirection === YDirection.UP && player.body.blocked.down) {
        player.body.setVelocityY(-200);
      } else if (player.yDirection === YDirection.DOWN && !player.body.blocked.down) {
        player.body.setVelocityY(150);
      }
    });

    if (!state.players.every(({ body }) => body.velocity.x === 0 && body.velocity.y === 0 && body.blocked.down)) {
      state.physics.world.update(ctx.time, timeDelta * 1000);
    }
  }
}
