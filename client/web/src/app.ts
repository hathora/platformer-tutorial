import Phaser from "phaser";
import { InterpolationBuffer } from "interpolation-buffer";

import { HathoraClient, HathoraConnection, StateId } from "../../.hathora/client";
import { GameState, Player, UserId, XDirection, YDirection } from "../../../api/types";

const client = new HathoraClient();

export class GameScene extends Phaser.Scene {
  private connection!: HathoraConnection;
  private stateBuffer: InterpolationBuffer<GameState> | undefined;
  private players: Map<UserId, Phaser.GameObjects.Sprite> = new Map();

  constructor() {
    super("game");
  }

  preload() {
    this.load.image("background", "background.png");
    this.load.image("platform", "platform.png");
    this.load.spritesheet("player", "player.png", { frameWidth: 32, frameHeight: 32 });
  }

  init() {
    getToken().then(async (token) => {
      const stateId = await getStateId(token);
      this.connection = await client.connect(
        token,
        stateId,
        ({ state, updatedAt }) => {
          if (this.stateBuffer === undefined) {
            this.stateBuffer = new InterpolationBuffer(state, 50, lerp);
          } else {
            this.stateBuffer.enqueue(state, [], updatedAt);
          }
        },
        (err) => console.error("Error occured", err.message)
      );
      await this.connection.joinGame({});
    });
  }

  create() {
    // background
    this.add.tileSprite(0, 0, this.scale.width, this.scale.height, "background").setOrigin(0, 0);

    // platforms
    this.add.tileSprite(40, 530, 288, 16, "platform").setOrigin(0, 0);
    this.add.tileSprite(340, 440, 192, 16, "platform").setOrigin(0, 0);
    this.add.tileSprite(140, 350, 192, 16, "platform").setOrigin(0, 0);
    this.add.tileSprite(360, 270, 288, 16, "platform").setOrigin(0, 0);
    this.add.tileSprite(704, 200, 96, 16, "platform").setOrigin(0, 0);

    // animations
    this.anims.create({
      key: "idle",
      frames: this.anims.generateFrameNumbers("player", { start: 0, end: 10 }),
      frameRate: 15,
    });
    this.anims.create({
      key: "walk",
      frames: this.anims.generateFrameNumbers("player", { start: 11, end: 22 }),
    });
    this.anims.create({
      key: "jump",
      frames: [{ key: "player", frame: 23 }],
    });
    this.anims.create({
      key: "fall",
      frames: [{ key: "player", frame: 24 }],
    });

    // input handling
    const keys = this.input.keyboard.createCursorKeys();
    let prevInputs: { horizontal: XDirection; vertical: YDirection } = {
      horizontal: XDirection.NONE,
      vertical: YDirection.NONE,
    };
    const handleKeyEvt = () => {
      const inputs = {
        horizontal: keys.left.isDown ? XDirection.LEFT : keys.right.isDown ? XDirection.RIGHT : XDirection.NONE,
        vertical: keys.up.isDown ? YDirection.UP : YDirection.NONE,
      };
      if (JSON.stringify(inputs) !== JSON.stringify(prevInputs)) {
        this.connection.setDirection(inputs);
        prevInputs = inputs;
      }
    };
    this.input.keyboard.on("keydown", handleKeyEvt);
    this.input.keyboard.on("keyup", handleKeyEvt);
  }

  update() {
    if (this.stateBuffer === undefined) {
      return;
    }

    const { state } = this.stateBuffer.getInterpolatedState(Date.now());

    state.players.forEach((player) => {
      if (!this.players.has(player.id)) {
        this.addPlayer(player);
      } else {
        this.updatePlayer(player);
      }
    });
  }

  private addPlayer({ id, x, y }: Player) {
    const sprite = this.add.sprite(x, y, "player").setOrigin(0, 0);
    this.players.set(id, sprite);
  }

  private updatePlayer({ id, x, y, xDirection, yDirection }: Player) {
    const sprite = this.players.get(id)!;

    if (xDirection === XDirection.LEFT) {
      sprite.setFlipX(true).anims.play("walk", true);
    } else if (xDirection === XDirection.RIGHT) {
      sprite.setFlipX(false).anims.play("walk", true);
    } else if (yDirection === YDirection.NONE) {
      sprite.anims.play("idle", true);
    }
    if (yDirection === YDirection.UP) {
      sprite.anims.play("jump", true);
    } else if (yDirection === YDirection.DOWN) {
      sprite.anims.play("fall", true);
    }

    sprite.x = x;
    sprite.y = y;
  }
}

async function getToken(): Promise<string> {
  const storedToken = sessionStorage.getItem(client.appId);
  if (storedToken !== null) {
    return storedToken;
  }
  const token = await client.loginAnonymous();
  sessionStorage.setItem(client.appId, token);
  return token;
}

async function getStateId(token: string): Promise<StateId> {
  if (location.pathname.length > 1) {
    return location.pathname.split("/").pop()!;
  } else {
    const stateId = await client.create(token, {});
    history.pushState({}, "", `/${stateId}`);
    return stateId;
  }
}

function lerp(from: GameState, to: GameState, pctElapsed: number): GameState {
  return {
    players: to.players.map((toPlayer) => {
      const fromPlayer = from.players.find((p) => p.id === toPlayer.id);
      return fromPlayer !== undefined ? lerpPlayer(fromPlayer, toPlayer, pctElapsed) : toPlayer;
    }),
  };
}

function lerpPlayer(from: Player, to: Player, pctElapsed: number): Player {
  return {
    ...to,
    x: from.x + (to.x - from.x) * pctElapsed,
    y: from.y + (to.y - from.y) * pctElapsed,
  };
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: [GameScene],
  parent: "phaser-container",
});
