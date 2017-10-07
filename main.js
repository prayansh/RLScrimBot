let unirest = require('unirest');
let logger = require('winston');
let auth = false;
try {
    auth = require('./auth.json');
} catch (ex) {
    auth = false;
}

let properties = require('./properties.json');

const Discord = require("discord.js");
const client = new Discord.Client();
const team_prefix = 'TEAM';

const mongoose = require('mongoose');
// Mongoose Schema definition
let userSchema = new mongoose.Schema({
    steamId: String,
    discordId: String,
    name: String,
    platform: Number
});
User = mongoose.model('UsersDB', userSchema);


let getAuth = function (type) {
    let token = '';
    if (type.toLowerCase() === 'discord') {
        token = (auth) ? auth.discord_token : process.env.DISCORD_TOKEN;
    } else if (type.toLowerCase() === 'rl') {
        token = (auth) ? auth.rl_token : process.env.RL_TOKEN;
    } else if (type.toLowerCase() === 'mongo') {
        token = (auth) ? auth.mongo_pass : process.env.MONGO_PASS;
    }
    return token;
};

let getPlayerDataBatch = function (playerData, callback) {
    console.log("Getting Player Data");
    let Request = unirest.post('https://api.rocketleaguestats.com/v1/player/batch');

    Request.headers({
        'Authorization': getAuth('rl'),
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    });
    Request.send(playerData);

    Request.end(function (response) {
        if (response.status === 429) {
            console.log("Request has been ratelimited: '" + response.body.message + "'.");
        }

        callback(response.status, response.body);
    });
};

let randomFunnyMessages = [
    "I am back!",
    "The salt is real ;)",
    "Lets get to scrimming bois",
    "Whats up lads!",
    "I love it when a plan comes together",
    "This feels like home"
];


let mongo_uri = "mongodb://"
        + properties.mongo_user + ":" + getAuth('mongo') + "@"
        + "rldiscordbot-shard-00-00-k9ogi.mongodb.net:27017"
        + ",rldiscordbot-shard-00-01-k9ogi.mongodb.net:27017"
        + ",rldiscordbot-shard-00-02-k9ogi.mongodb.net:27017"
        + "/" + properties.mongo_db
        + "?ssl=true&replicaSet=RLDiscordBot-shard-0&authSource=admin"
    ;


mongoose.connect(mongo_uri, function (err) {
    if (err) console.error(err);
    else console.log('mongo connected');
});

function shuffle(a) {
    for (let i = a.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [a[i - 1], a[j]] = [a[j], a[i - 1]];
    }
}

function form(players, teams) {
    while (players.length !== 0) {
        for (let team of teams) {
            let index = Math.floor(Math.random() * players.length);
            team.push(players[index]);
            players.splice(index, 1);
        }
    }
    return teams;
}

client.on("ready", () => {
    // This event will run if the bot starts, and logs in, successfully.
    console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`);
    // Example of changing the bot's playing game to something useful. `client.user` is what the
    // docs refer to as the "ClientUser".
    client.user.setGame(`scrims`);
    let guilds = client.guilds.array();
    guilds.forEach(function (guild) {
        let val = Math.floor(Math.random() * randomFunnyMessages.length);
        guild.channels.find(channel => channel.name.toLowerCase() === 'general')
            .send(randomFunnyMessages[val]);
    });
});

client.on("guildCreate", guild => {
    // This event triggers when the bot joins a guild.
    console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
    client.user.setGame(`on ${client.guilds.size} servers`);
});


client.on("message", function (message) {
    if (message.author.bot) return;

    if (message.content.indexOf('!') !== 0) return;

    const args = message.content.slice(1).trim().split(/ +/g);
    const command = args.shift().toLowerCase();
    if (command.toLowerCase() === 'scrim') {
        let channel = false;
        if (args[0]) {
            channel = client.channels.get(args[0]);
        } else if (message.member.voiceChannel) {
            channel = message.member.voiceChannel;
        } else {
            //invalid
            message.channel.send("Type !scrim voice-channel-id or by joining the voice channel and typing !scrim")
                .then(message => console.log(`Sent message: ${message.content}`))
                .catch(console.error);
        }
        if (channel) {
            let memberIds = channel.members.array();
            let teams = form(shuffle(memberIds), [[], []]);
            let i = 1;

            teams.forEach(function (team) {
                message.guild.createChannel(`${team_prefix}#${i}`, 'voice')
                    .then(channel => {
                        console.log(`Created new channel ${channel}`);
                        team.forEach(function (player) {
                            player.setVoiceChannel(channel)
                                .then(() => console.log(`${player} added to ${channel}`))
                                .catch(console.error);
                        });
                    })
                    .catch(console.error);
                i++;
            });

            // let queryPayload = [];
            // memberIds.forEach(function (id) {
            //     queryPayload.push({discordId: id});
            // });
            // let query = {'$or': queryPayload};
            // User.find(query, function (err, users) {
            //     if (users) {
            //         let usermap = {};
            //         let batchPayload = [];
            //         users.forEach(function (user) {
            //             batchPayload.push({"platformId": user.platform, "uniqueId": user.steamId});
            //             usermap.steamId = user.discordId;
            //         });
            //         getPlayerDataBatch(batchPayload, function (status, body) {
            //             console.log(`
            // PlayerDataBatch: responseCode = ${status}`);
            //             console.log('PlayerDataBatch body=' + JSON.stringify(body));
            //             let teams = formTeams(body, [[], []]);
            //             let team1 = teams[0];
            //             let team2 = teams[2];
            //         });
            //     }
            // });
        }
    }
    if (command.toLowerCase() === 'clean') {
        let channels = message.guild.channels.filterArray(function (channel) {
            return channel.type === 'voice';
        });
        channels.forEach(function (channel) {
            let vChannel = channel;
            if (vChannel.name.indexOf(team_prefix) !== -1) {
                console.log('#4');
                vChannel.delete('delete temp channel')
                    .then(channel => console.log(`Deleted temp channel :${channel.name}`))
                    .catch(console.error); // Log error
            }
        });

    }
});

client.login(getAuth('discord'));