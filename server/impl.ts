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
import { GAME_HEIGHT, GAME_WIDTH, PLATFORMS } from "../shared/common";

const GRAVITY = 200;
const PLAYER_SPEED = 200;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 32;

type InternalPlayer = {
  id: UserId;
  body: Body;
  xDirection: XDirection;
  yDirection: YDirection;
};
type InternalState = {
  physics: ArcadePhysics;
  players: InternalPlayer[];
  platforms: Body[];
};

export class Impl implements Methods<InternalState> {
  initialize(ctx: Context, request: IInitializeRequest): InternalState {
    const physics = new ArcadePhysics({
      sys: {
        game: { config: {} },
        settings: { physics: { gravity: { y: GRAVITY } } },
        scale: { width: GAME_WIDTH, height: GAME_HEIGHT },
      },
    });
    return {
      physics,
      players: [],
      platforms: PLATFORMS.map((platform) => {
        return physics.add
          .body(platform.x, platform.y, platform.width, platform.height)
          .setAllowGravity(false)
          .setImmovable(true);
      }),
    };
  }
  joinGame(state: InternalState, userId: UserId, ctx: Context, request: IJoinGameRequest): Response {
    if (state.players.some((player) => player.id === userId)) {
      return Response.error("Already joined");
    }

    // spawn player at (0, 0)
    const playerBody = state.physics.add.body(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
    playerBody.setCollideWorldBounds(true, undefined, undefined, undefined);
    playerBody.pushable = false;

    // set up colliders with other players and platforms
    state.players.forEach((player) => state.physics.add.collider(playerBody, player.body));
    state.platforms.forEach((platformBody) => state.physics.add.collider(playerBody, platformBody));

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
        const [xVelocity, yVelocity] = [player.body.velocity.x, player.body.velocity.y];
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
        player.body.setVelocityX(-PLAYER_SPEED);
      } else if (player.xDirection === XDirection.RIGHT && !player.body.blocked.right) {
        player.body.setVelocityX(PLAYER_SPEED);
      } else if (player.xDirection === XDirection.NONE) {
        player.body.setVelocityX(0);
      }
      if (player.yDirection === YDirection.UP && player.body.blocked.down) {
        player.body.setVelocityY(-GRAVITY);
      }
    });
    if (!state.players.every(({ body }) => body.velocity.x === 0 && body.velocity.y === 0 && body.blocked.down)) {
      state.physics.world.update(ctx.time, timeDelta * 1000);
    }
  }
}
