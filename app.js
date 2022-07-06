const vorpal = require("vorpal")();
const fs = require("fs");
const { RtmpStream } = require("@magicfun1241/streamer");
let chalk = vorpal.chalk;
let request = require("request");

let streams = [];

vorpal
  .command("setup")
  .description("Setup the application")
  .action(async function (args, callback) {
    const result = await this.prompt([
      {
        type: "input",
        name: "count",
        message: "How many channels do you want to set up? ",
      },
    ]);
    this.log("\n\n");
    const count = result.count;

    let promptArray = [];
    for (let i = 1; i < count; i++) {
      promptArray.push(
        {
          type: "input",
          name: `channel${i}name`,
          message: `What is the name of channel ${i}? `,
        },
        {
          type: "input",
          name: `channel${i}key`,
          message: `Specify the twitch livestream key for channel ${i}? `,
        }
      );
    }

    const result2 = await this.prompt(promptArray);

    let roflolmao = [];
    const resultSource = await this.prompt([
      {
        type: "input",
        name: "source_video",
        message: "Please provide a path to the video source (gif/mp4/...) ",
      },
      {
        type: "confirm",
        name: "source_audio_q",
        message: "Is the provided video source the same as the audio source? ",
      },
      {
        type: "input",
        name: "source_audio",
        message: "Please provide a path to the audio source (mp3/...) ",
        when: (answer) => false == false,
      },
    ]);
    this.log(
      chalk.red("CURRENTLY ONLY SUPPORTS VIDEO SOURCE NO SEPERATE AUDIO SOURCE")
    );
    let source = {};
    if (resultSource.source_audio_q === false) {
      source = {
        video: resultSource.source_video,
        audio: resultSource.source_audio,
      };
    } else {
      source = {
        video: resultSource.source_video,
      };
    }

    let channels = [];
    for (let i = 1; i < count; i++) {
      channels.push({
        name: result2[`channel${i}name`],
        file: result2[`channel${i}file`],
        key: result2[`channel${i}key`],
      });
    }

    const result3 = await this.prompt([
      {
        type: "input",
        name: "ingest",
        default: "rtmp://fra05.contribute.live-video.net/app",
        message: "Which twitch ingest server do you want to use? ",
      },
    ]);

    const ingest = result3.ingest;

    fs.writeFile(
      "./config.json",
      JSON.stringify({ channels, ingest, source }),
      function (err) {
        if (err) {
          return console.log(err);
        }
      }
    );
  });

vorpal
  .command("start")
  .description("Start the stream for all or for only one channel")
  .action(async function (args, callback) {
    const config = require("./config.json");
    const channels = config.channels;
    const result = await this.prompt([
      {
        type: "list",
        name: "channel",
        default: "All",
        message: "Which channel do you want to start?",
        choices: channels.concat("All"),
      },
    ]);

    const channel = result.channel;
    if (channel === "All") {
      for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        const file = channel.file;
        const key = channel.key;
        const ingest = config.ingest;

        const stream = new RtmpStream({
          outputProtocol: "rtmp",
          input: config.source.video,
          output: ingest,
          key: key,
        });

        stream.start(config.source.audio || null);

        streams.push({ channel, stream, startTime: new Date().getTime() });
      }
    } else {
      channels.forEach((channel) => {
        if (channel.name === result.channel) {
          const key = channel.key;
          const ingest = config.ingest;

          const stream = new RtmpStream({
            outputProtocol: "rtmp",
            input: config.source.video,
            output: ingest,
            key: key,
          });

          stream.start(config.source.audio || null);

          streams.push({ channel, stream, startTime: new Date().getTime() });
        }
      });
    }
    this.log(chalk.green(`Stream for ${channel} started\n`));
  });

vorpal
  .command("streams")
  .description("List all the streams")
  .action(async function (args, callback) {
    streams.forEach((stream) => {
      const now = new Date().getTime();
      const runningSince = now - stream.startTime;
      const runningSinceString = `${Math.floor(
        runningSince / 1000 / 60
      )} minutes`;
      this.log(
        `${stream.channel.name} is streaming since ${runningSinceString}`
      );
    });
  });

vorpal
  .command("kill")
  .description("Kill a specific or all streams")
  .action(async function (args, cb) {
    const choices = streams
      .map((stream) => {
        return stream.channel.name;
      })
      .concat("All");

    const result = await this.prompt([
      {
        type: "list",
        name: "channel",
        default: "All",
        message: "Which channel do you want to kill? ",
        choices: choices,
      },
    ]);

    const channel = result.channel;
    if (channel === "All") {
      streams.forEach((stream) => {
        stream.stream.stop();
      });
    } else {
      streams.forEach((stream) => {
        if (stream.channel.name === channel) {
          stream.stream.stop();
        }
      });
    }
  });

vorpal
  .command("check")
  .description("Checks if a stream or all streams are running")
  .action(async function (args, cb) {
    const choices = streams
      .map((stream) => {
        return stream.channel.name;
      })
      .concat("All");

    const result = await this.prompt([
      {
        type: "list",
        name: "channel",
        default: "All",
        message: "Which channel do you want to check? ",
        choices: choices,
      },
    ]);

    // forget this for now lol

    const channel = result.channel;

    const header = {
      "Client-ID": "cm3ds5bjofq9lhr9hl5135bc1nfrxj",
    };
    if (channel === "All") {
      streams.forEach(async (LocalStream) => {
        const url = `https://api.twitch.tv/helix/streams?user_login=${LocalStream.channel.name}`;
        const response = await request(url, {
          headers: header,
        });
        const json = await response.json();
        console.log(json)
        if (json.data.length === 0) {
          this.log(chalk.red(`${LocalStream.channel.name} is not streaming`));
        } else {
          this.log(chalk.green(`${LocalStream.channel.name} is streaming`));
        }
      });
    } else {
      streams.forEach(async (LocalStream) => {
        if (LocalStream.channel.name === channel) {
          const usersURL =
            "https://api.twitch.tv/kraken/users?login=" +
            LocalStream.channel.name;
          const firstReq = await request.get(usersURL).set(header);
          const { users } = firstReq.body;
          const { _id: id } = users[0],
            streamsURL = "https://api.twitch.tv/kraken/streams/" + id;

          const streamResponse = await request.get(streamsURL).set(header);

          const stream = JSON.parse(streamResponse.text).stream;
          if (stream) {
            this.log(
              `${stream.channel.name} is streaming since ${stream.created_at} and has ${stream.viewers} viewers`
            );
          } else {
            this.log(`${stream.channel.name} is not streaming`);
          }
        }
      });
    }
  });

vorpal.delimiter("multistreamer$").show();
