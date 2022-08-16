import { Methods, Context } from "./.hathora/methods";
import { Response } from "../api/base";
import {
  XDirection,
  YDirection,
  Player,
  GameState,
  UserId,
  IInitializeRequest,
  IJoinGameRequest,
  ISetDirectionRequest,
} from "../api/types";

type InternalState = GameState;

export class Impl implements Methods<InternalState> {
  initialize(ctx: Context, request: IInitializeRequest): InternalState {
    return {
      players: [],
    };
  }
  joinGame(state: InternalState, userId: UserId, ctx: Context, request: IJoinGameRequest): Response {
    if (state.players.some((player) => player.id === userId)) {
      return Response.error("Already joined");
    }
    state.players.push({
      id: userId,
      x: 0,
      y: 0,
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
    return state;
  }
}
