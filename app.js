const vorpal = require("vorpal")();
const fs = require("fs");
const { RtmpStream } = require("@magicfun1241/streamer");
let chalk = vorpal.chalk;
let axios = require("axios");

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
  .description("List all the local running streams")
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
  .description("Checks if twitch recognizes the streams as running")
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

    const channel = result.channel;

    if (channel === "All") {
      streams.forEach(async (LocalStream) => {
        checkIfLiveAndViewCount(LocalStream.channel.name).then((result) => {
          if (result.stream_id) {
            this.log(
              chalk.green(
                `${LocalStream.channel.name} is streaming with ${result.viewers} viewers`
              )
            );
          } else {
            this.log(chalk.red(`${LocalStream.channel.name} is not streaming`));
          }
        });
      });
    } else {
      streams.forEach(async (LocalStream) => {
        if (LocalStream.channel.name === channel) {
          checkIfLiveAndViewCount(LocalStream.channel.name).then((result) => {
            if (result.stream_id) {
              this.log(
                chalk.green(
                  `${LocalStream.channel.name} is streaming with ${result.viewers} viewers`
                )
              );
            } else {
              this.log(
                chalk.red(`${LocalStream.channel.name} is not streaming`)
              );
            }
          });
        }
      });
    }
  });
function getTwitchHeader() {
  const header = {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US",
    Authorization: "undefined",
    "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
    Connection: "keep-alive",
    "Content-Type": "text/plain; charset=UTF-8",
    "Device-ID": "pkXjq7q8Qownz1owUogMDR9xKbxiCrC2",
    Origin: "https://www.twitch.tv",
    Referer: "https://www.twitch.tv/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Sec-GPC": "1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.114 Safari/537.36",
  };
  return header;
}
async function checkIfLiveAndViewCount(channel) {
  return new Promise((resolve, reject) => {
    axios
      .post(
        "https://gql.twitch.tv/gql",
        [
          {
            operationName: "UseLive",
            variables: {
              channelLogin: channel,
            },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash:
                  "639d5f11bfb8bf3053b424d9ef650d04c4ebb7d94711d644afb08fe9a0fad5d9",
              },
            },
          },
          {
            operationName: "UseViewCount",
            variables: {
              channelLogin: channel,
            },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash:
                  "00b11c9c428f79ae228f30080a06ffd8226a1f068d6f52fbc057cbde66e994c2",
              },
            },
          },
        ],
        {
          headers: getTwitchHeader(),
        }
      )
      .then((response) => {
        if (!response.data[0].data.user.stream)
          return resolve({ stream_id: null });

        resolve({
          stream_id: response.data[0].data.user.stream.id,
          channel_id: response.data[0].data.user.id,
          channel_name: response.data[0].data.user.login,
          streamingSince:
            new Date(response.data[0].data.user.stream.createdAt).getTime() /
            1000,
          viewers: response.data[1].data.user.stream.viewersCount,
        });
      });
  });
}

vorpal.delimiter("multistreamer$").show();
