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
    }
    return token;
};

let randomFunnyMessages = [
    "I am back!",
    "The salt is real ;)",
    "Lets get to scrimming bois",
    "Whats up lads!",
    "I love it when a plan comes together",
    "This feels like home"
];

let voiceChannel = false;

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
            voiceChannel = channel;
        }
    }
    if (command.toLowerCase() === 'clean') {
        let channels = message.guild.channels.filterArray(function (channel) {
            return channel.type === 'voice';
        });
        channels.forEach(function (channel) {
            let vChannel = channel;
            if (vChannel.name.indexOf(team_prefix) !== -1) {
                if (voiceChannel) {
                    vChannel.members.every(function (player) {
                        player.setVoiceChannel(voiceChannel)
                            .then(() => console.log(`${player} added back to ${voiceChannel}`))
                            .catch(console.error);
                        return true;
                    });
                }
                vChannel.delete('delete temp channel')
                    .then(channel => console.log(`Deleted temp channel :${channel.name}`))
                    .catch(console.error); // Log error
            }
        });
        voiceChannel = false;
    }
});

client.login(getAuth('discord'));