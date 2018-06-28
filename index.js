const Discord = require('discord.js');
const client = new Discord.Client({fetchAllMembers: true});
const mysql = require('mysql');
const config = require('./config.json');
const func = require('./functions.js');
const dateFormat = require('dateformat');
exports.client = client;

const pool = mysql.createPool({
	host: config.sql.host,
	user: config.sql.user,
	password: config.sql.password,
	database: config.sql.database,
	multipleStatements: true
});
var messages = {
	leaderboard: null,
	matches: null
}
var colour = {
	blue: 3447003,
	red: 0xF04747,
	orange: 0xFAA61A,
	green: 0x43b581
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username} on ${client.guilds.size} server(s)`);

	client.user.setPresence({ status: 'online', game: { name: `${config.prefix}help` } });

	func.getChannel(config.leaderboardMessage.channel).fetchMessage(config.leaderboardMessage.message).then((message) => {
		messages.leaderboard = message;
		console.log('Fetched leaderboard message');
		recalculateStats();
	}).catch((err) => {
		if (err) console.log('Error fetching leaderboard message');
	});
	func.getChannel(config.matchesMessage.channel).fetchMessage(config.matchesMessage.message).then((message) => {
		messages.matches = message;
		console.log('Fetched matches message');
		updateMatchesMessage();
		scheduleLoop();
	}).catch((err) => {
		if (err) console.log('Error fetching matches message');
	});
});

client.on('error', console.error);

client.on('message', (message) => {
	if (message.channel.guild === undefined || message.guild.id !== config.guild) return;
	if (message.author.bot || message.content.indexOf(config.prefix) !== 0) return;
	if (message.author.bot || message.content.indexOf(config.prefix) !== 0) return;

	const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
	const command = args.shift().toLowerCase();

	pool.query('SELECT clanname FROM clans WHERE leaderid LIKE CONCAT("%", ?, "%")', [message.author.id], (err, result) => {
		if (err) throw err;
		let clanleader = (result.length) ? result[0].clanname : null;
		let isadmin = func.userHasRole(message.author, config.role.admin);

		if (command === 'ping' && isadmin) {
			return message.channel.send(`Pong! Latency: ${Math.round(client.ping)} ms`);
		}

		if (command === 'help' || command === 'commands') {
			// Information
			message.author.send(new Discord.RichEmbed()
				.setColor(colour.blue)
				.setAuthor('Bot usage', client.user.displayAvatarURL)
				.setDescription(`Commands are only detected when sent in ${func.getChannel(config.channel.commands)}\nClan leaderboard and match information are displayed in ${func.getChannel(config.leaderboardMessage.channel)}`)
				.addField('1. Schedule', `Two clans first need to schedule a date and time for a match using the ${config.prefix}schedule command`)
				.addField('2. Play', `When the scheduled time arrives, the clans play their match`)
				.addField('3. Report', `Once the match is over, either clan can report the score of the match using the ${config.prefix}report command`)
				.addField('4. Confirm', `The opposing clan must confirm the results of the match using the ${config.prefix}confirm command for it to be finalised`)
				// .addField('Message colours', `Red: Incorrect command usage, match cancelled or match rejected\nOrange: Requires action\nGreen: Match scheduled or confirmed\nBlue: Informational responses`)
				.addField('​', 'Made by <@193177252815568897>. Find me on [THD Forum](https://forum.thd.vg/members/epsilon.16800/), [Steam](https://steamcommunity.com/id/epsilon_steam/) and [YouTube](https://www.youtube.com/channel/UC_NcDuriT-GRYplpnZgpdkQ)!')
			);
			// All commands
			message.author.send(new Discord.RichEmbed()
				.setColor(colour.blue)
				.setAuthor('Commands', client.user.displayAvatarURL)
				.addField(config.prefix + 'help/commands', `DMs you the bot commands... exactly what you're looking at right now!`)
				.addField(config.prefix + 'add/create clan (clan name)', `Requests for an admin to add your clan to the database with you as leader`)
				.addField(config.prefix + 'clans', `Lists all the clans in the database with their leader`)
				.addField(config.prefix + 'stats (clan)', 'Displays the stats of the specified clan and their past matches. If you are a clan leader, leave the clan empty to display the stats of your clan​')
				.addField(config.prefix + 'members (clan)', `Lists all the members with the specified clan's role. If you are a clan leader, leave the clan empty to display the stats of your clan`)
			);
			// Clan leader commands
			message.author.send(new Discord.RichEmbed()
				.setColor(clanleader ? colour.blue : colour.red)
				.setAuthor('Clan leader commands', client.user.displayAvatarURL)
				.addField(config.prefix + 'remove/delete clan (clan)', `Requests for an admin to remove your clan from the database`)
				.addField(config.prefix + 'change clanname (old name) (new name)', `Changes the name of your clan. The new name cannot be the same as another clan`)
				.addField(config.prefix + 'change region (clan) (new region)', `Changes the region of your clan. The region can be either AUS, EU or US`)
				// .addField(config.prefix + 'change leader (clan) (new leader)', `Changes the leader of your clan. The new leader cannot be the leader of another clan. This removes your leadership of the clan!`)
				.addField(config.prefix + 'add leader (clan) (leader)', `Adds a leader to your clan. The user cannot be the leader of another clan`)
				.addField(config.prefix + 'add members (clan role) (users...)', `Adds members to your clan. Multiple members can be specified at once`)
				.addField(config.prefix + 'remove leader (clan) (leader)', `Removes a leader from your clan. If you remove yourself, you will lose your leadership of the clan!`)
				.addField(config.prefix + 'remove members (clan role) (users...)', `Removes members to your clan`)
				.addField(config.prefix + 'report/score (winning clan) (losing clan) (score: X-X)', `Reports the scores of a scheduled match. Keep in mind the winning team needs to be stated first, and because to this, allows the score to be written in any order (e.g. 2-1 or 1-2)`)
				.addField(config.prefix + 'confirm/accept (clan)', `Confirms the reported scores of a match. The opposing clan of the clan who reported the scores has to confirm the match (or an admin)`)
				.addField(config.prefix + 'reject/deny (clan)', `Requests for an admin to confirm the pending match with a different score or reject it`)
				.addField(config.prefix + 'schedule (clan) (date: DD/MM/YY) (24h UTC time: HH:MM)', `Schedules a match against the specified clan at the specified date and time. Time is in UTC and needs to be entered using 24h format (e.g. 6:30pm = 18:30). Dates are restricted to within a month from the current time to prevent the match from being forgotten. The time cannot be within ${config.vars.clashTime} minutes of another scheduled match`)
				.addField(config.prefix + 'cancel (clan)', `Cancels the scheduled match against the specified clan`)
			);
			// Admin commands
			message.author.send(new Discord.RichEmbed()
				.setColor((isadmin) ? colour.blue : colour.red)
				.setAuthor('Admin commands', client.user.displayAvatarURL)
				// .addField(config.prefix + 'ping', `Responds with the bot latency. Used to check if the bot is running`)
				.addField(config.prefix + 'add/create clan (clan name) (leader)', `Adds the clan to the database with the specified leader`)
				.addField(config.prefix + 'add match (winner) (loser) (score: X-X) (date: DD/MM/YY) (24h UTC time: HH:MM)', `Adds a match to the database`)
				.addField(config.prefix + 'remove/delete clan (clan)', `Removes the specified clan from the database while still keeping their past matches`)
				.addField(config.prefix + 'remove/delete match (clanA) (clanB)', `Removes the most recent match between the two specified clans. This causes the Elo of the teams to be recalculated without the match`)
				// .addField(config.prefix + 'change leader (clan) (new leader)', `Changes the leader of the specified clan. The new leader cannot be the leader of another clan`)
				.addField(config.prefix + 'confirm/accept (clanA) (clanB) (actual score?)', `Confirms a pending match between the specified clans. Stating a score overrides the reported score in case it is incorrect. Keep in mind some clans may lie about the score`)
				.addField(config.prefix + 'reject/deny (clanA) (clanB)', `Rejects a pending match between the specified clans and removes the match from the schedule. Use this as a last resort if there is an argument over the score`)
				.addField(config.prefix + 'cancel (clanA) (clanB)', `Cancels the scheduled match between the two specified clans`)
				.addField(config.prefix + 'reset (stats/clans/pending/matches/schedule/all)', `Resets certain components of the bot\nStats: Resets wins, losses, draws and Elo of all clans\nClans: Resets everything involving clans except past matches\nPending: Resets pending matches\nMatches: Resets past matches and therefore the stats of all clans\nSchedule: Resets scheduled matches\nAll: Resets everything!`)
				.addField(config.prefix + 'reload/refresh', `Reloads the panels and ensures Elo is properly calculated`)
			);
			return;
		}

		if (config.channel.commands === '' || message.channel.id !== config.channel.commands) return;

		if (0 && command === 'swap' && isadmin) { // For testing purposes!
			if (args.length < 2) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}swap (clanA) (clanB)`)
			);
			let clanA = args[0];
			let clanB = args[1];
			if (clanA.toLowerCase() === clanB.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clans')
				.setDescription(`You can't swap a leader with themself`)
			);
			pool.query('SELECT clanname, leaderid FROM clans WHERE clanname = ? OR clanname = ?', [clanA, clanB], (err, result) => {
				if (err) throw err;
				if (result.length < 2) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clans')
					.setDescription(`A clan doesn't exist`)
				);
				let a = result.find(x => x.clanname.toLowerCase() === clanA.toLowerCase());
				let b = result.find(x => x.clanname.toLowerCase() === clanB.toLowerCase());
				clanA = a.clanname;
				clanB = b.clanname;
				let clanAleader = a.leaderid;
				let clanBleader = b.leaderid;
				pool.query('UPDATE clans SET leaderid = ? WHERE clanname = ?; UPDATE clans SET leaderid = ? WHERE clanname = ?', [clanAleader, clanB, clanBleader, clanA], (err) => {
					if (err) throw err;
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Clan leaders swapped')
						.setDescription(`${clanA} - <@${clanBleader}>\n${clanB} - <@${clanAleader}>`)
					);
				});
			});
		}

		if ((command === 'add' || command === 'create') && args[0] === 'clan') {
			if (args.length < 2) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (clan name) (region)`)
			);
			let clan = args[1];
			let region = args[2].toUpperCase();
			let leader = func.getUser((isadmin) ? args[3] || message.author.id : message.author.id);
			if (clan.length > 10) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan name')
				.setDescription('Maximum 10 characters')
			);
			if (!leader) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`Mention the user or use their ID or tag (abc#1234)`)
			);
			if (leader.user.bot) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`A bot can't be the leader of a clan`)
			);
			if (!region.match(/^(AUS|EU|US)$/)) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid region')
				.setDescription(`Please specify either AUS, EU or US`)
			);
			pool.query('SELECT clanname, leaderid FROM clans WHERE clanname = ?; SELECT clanname FROM clans WHERE leaderid LIKE CONCAT("%", ?, "%")', [clan, leader.id], (err, result) => {
				if (err) throw err;
				if (result[0].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan name')
					.setDescription(`Clan already exists\nClan: ${result[0][0].clanname}\nLeaders: ${func.mentionUsers(result[0][0].leaderid)}`)
				);
				if (result[1].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid user')
					.setDescription(`${(leader.id === message.author.id) ? 'You are' : 'The user is'} the leader of another clan\nClan: ${result[1][0].clanname}`)
				);
				if (isadmin) {
					pool.query('INSERT INTO clans (clanname, leaderid, region) VALUES (?, ?, ?)', [clan, leader.id, region], (err) => {
						if (err) throw err;
						updateLeaderboardMessage();
						let role = func.getRole(clan);
						if (role) leader.addRole(role);
						else client.guilds.get(config.guild).createRole({
							name: clan,
							color: 'RANDOM',
							mentionable: 1,
							hoist: config.vars.hoistRoles
						}).then((role) => {
							leader.addRole(role);
						});
						return message.channel.send(new Discord.RichEmbed()
							.setColor(colour.blue)
							.setTitle(`Clan ${command}${(command === 'add') ? 'ed' : 'd'}`)
							.setDescription(`Clan: ${clan}\nRegion: ${region}\nLeader: <@${leader.id}>`)
						);
					});
				} else {
					message.channel.send(new Discord.RichEmbed()
						.setColor(colour.orange)
						.setTitle(`Request to ${command} clan`)
						.setDescription(`Clan: ${clan}\nLeader: <@${leader.id}>\nAwaiting confirmation from <@&${config.role.admin}>`)
					);
					let adminrole = func.getRole(config.role.admin);
					if (adminrole) adminrole.members.forEach((member) => {
						member.send(new Discord.RichEmbed()
							.setColor(colour.orange)
							.setTitle(`Request to ${command} clan`)
							.setDescription(`Clan: ${clan}\nLeader: <@${leader.id}>`)
						);
					});
					return
				}
			});
		}

		if (command === 'add' && args[0] === 'leader' && (isadmin || clanleader)) {
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (clan) (user)`)
			);
			let clan = args[1];
			let leader = func.getUser(args[2]);
			if (!isadmin && clanleader.toLowerCase() !== clan.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`You can only add a leader to your clan`)
			);
			if (!leader) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`Mention the user or use their ID or tag (abc#1234)`)
			);
			if (leader.user.bot) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`A bot can't be the leader of a clan`)
			);
			pool.query('SELECT clanname, leaderid FROM clans WHERE clanname = ?; SELECT 1 FROM clans WHERE leaderid LIKE CONCAT("%", ?, "%")', [clan, leader.id], (err, result) => {
				if (err) throw err;
				if (!result[0].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`Clan doesn't exist`)
				);
				clan = result[0][0].clanname;
				if (result[0][0].leaderid.includes(leader.id)) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid user')
					.setDescription(`User is already the leader of this clan`)
				);
				if (result[1].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid user')
					.setDescription(`User is the leader of another clan`)
				);
				if (result[0][0].leaderid.split(/\D+/g).length === 3) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Cannot add leader')
					.setDescription(`Max of 3 leaders allowed`)
				);
				pool.query('UPDATE clans SET leaderid = CONCAT(leaderid, ",", ?) WHERE clanname = ?', [leader.id, clan], (err, result) => {
					if (err) throw err;
					let role = func.getRole(clan);
					if (role) leader.addRole(role);
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Leader added')
						.setDescription(`Clan: ${clan}\nLeader: <@${leader.id}>`)
					);
				});
			});
		}

		if (command === 'add' && (args[0] === 'member' || args[0] === 'members') && (isadmin || clanleader)) {
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (clan role) (users...)`)
			);
			let role = func.getRole(args[1]);
			let members = args.splice(2).map(x => func.getUser(x)).filter(x => x);
			if (!role) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid role')
				.setDescription(`Clan role doesn't exist`)
			);
			if (!isadmin && clanleader !== role.name) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`You can only add members to your clan`)
			);
			if (members.find(x => x.user.bot)) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`A bot can't be a member of a clan`)
			);
			if (!members.length) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`Mention a user or use their ID or tag (abc#1234)`)
			);
			newmembers = members.filter(x => !func.userHasRole(x, role)).map(x => x.toString());
			members.forEach(x => x.addRole(role));
			return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.blue)
				.setTitle(`${func.plural(newmembers.length, 'Member')} added`)
				.setDescription(`Clan: ${role.name}\n${func.plural(newmembers.length, 'Member')}: ${(newmembers.length) ? newmembers.join(' ') : 'None'}`)
			);
		}

		if (command === 'add' && args[0] === 'match' && isadmin) {
			if (args.length < 6) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (winner) (loser) (score: X-X) (date: DD/MM/YY) (24h UTC time: HH:MM)`)
			);
			let winclan = args[1];
			let loseclan = args[2];
			if (winclan.toLowerCase() === loseclan.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clans')
				.setDescription(`State two different clans`)
			);
			if (!/^\d+-\d+$/g.test(args[3])) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid score')
				.setDescription(`Score should be formatted X-X`)
			);
			let winscore = args[3].split('-').sort()[1];
			let losescore = args[3].split('-').sort()[0];
			if (winscore == 0 && losescore == 0) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid score')
				.setDescription(`Both clans can't have zero points`)
			);
			if (!/^\d\d?\/\d\d?\/\d\d$/g.test(args[4])) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid date')
				.setDescription(`Date should be formatted DD/MM/YY`)
			);
			if (!/^\d+:\d\d$/g.test(args[5])) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid time')
				.setDescription(`Time should be 24h UTC and formatted HH:MM`)
			);
			let date = args[4].split('/');
			let time = args[5].split(':');
			let d = new Date(Date.UTC('20' + date[2], date[1] - 1, date[0], time[0], time[1]));
			pool.query('SELECT 1 FROM clans WHERE clanname = ? OR clanname = ?', [winclan, loseclan], (err, result) => {
				if (err) throw err;
				if (result.length === 0) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clans')
					.setDescription(`Both clans don't exist`)
				);
				if (result.length === 1) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`A clan doesn't exist`)
				);
				pool.query('INSERT INTO clanwars (winclan, loseclan, winscore, losescore, datetime) VALUES (?, ?, ?, ?, ?)', [winclan, loseclan, winscore, losescore, dateFormat(d, 'isoUtcDateTime')], (err) => {
					if (err) throw err;
					updateMatchesMessage();
					recalculateStats();
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.green)
						.setTitle(`Match added: ${winclan} vs ${loseclan} (${winscore}-${losescore})`)
						.setDescription(`Date: ${dateFormat(d, 'UTC:dS mmmm, yyyy (dddd)')}\nTime: ${dateFormat(d, "UTC:h:MMtt 'UTC'")}`)
					);

				});
			});
		}

		if (command === 'remove' && args[0] === 'leader' && (isadmin || clanleader)) {
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (clan) (user)`)
			);
			let clan = args[1];
			let leader = func.getUser(args[2]);
			if (!isadmin && clanleader.toLowerCase() !== clan.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`You can only remove a leader from your clan`)
			);
			if (!leader) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`Mention the user or use their ID or tag (abc#1234)`)
			);
			pool.query('SELECT clanname, leaderid FROM clans WHERE clanname = ?', [clan], (err, result) => {
				if (err) throw err;
				if (!result.length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`Clan doesn't exist`)
				);
				clan = result[0].clanname;
				let leaders = result[0].leaderid.split(/\D+/g);
				if (!result[0].leaderid.includes(leader.id)) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid user')
					.setDescription(`User is not the leader of this clan`)
				);
				if (leaders.length === 1) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Cannot remove leader')
					.setDescription(`You can't remove the only leader of the clan`)
				);
				leaders.splice(leaders.indexOf(leader.id), 1);
				pool.query('UPDATE clans SET leaderid = ? WHERE clanname = ?', [leaders.join(','), clan], (err, result) => {
					if (err) throw err;
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Leader removed')
						.setDescription(`Clan: ${clan}\nLeader: <@${leader.id}>`)
					);
				});
			});
		}

		if ((command === 'remove' || command === 'delete') && args[0] === 'clan' && (isadmin || clanleader)) {
			if (args.length < 2) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (clan)`)
			);
			let clan = args[1];
			let leaderid;
			if (!isadmin && clanleader.toLowerCase() !== clan.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`You can only request to ${command} your clan`)
			);
			pool.query('SELECT clanname, leaderid FROM clans WHERE clanname = ?', [clan], (err, result) => {
				if (err) throw err;
				if (!result.length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`Clan doesn't exist`)
				);
				clan = result[0].clanname;
				leaderid = result[0].leaderid;
				if (isadmin) {
					pool.query('DELETE FROM clans WHERE clanname = ?; DELETE FROM pending WHERE winclan = ? OR loseclan = ?; DELETE FROM schedule WHERE clanA = ? OR clanB = ?', [clan, clan, clan, clan, clan], (err) => {
						if (err) throw err;
						updateLeaderboardMessage();
						updateMatchesMessage();
						let role = func.getRole(clan);
						if (role) role.delete();
						return message.channel.send(new Discord.RichEmbed()
							.setColor(colour.blue)
							.setTitle(`Clan ${command}d`)
							.setDescription(`Clan: ${clan}\nLeaders: ${func.mentionUsers(leaderid)}`)
						);
					});
				} else {
					message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle(`Request to ${command} clan`)
						.setDescription(`Clan: ${clan}\nLeaders: ${func.mentionUsers(leaderid)}\nAwaiting confirmation from <@&${config.role.admin}>`)
					);
					let adminrole = func.getRole(config.role.admin);
					if (adminrole) adminrole.members.forEach((member) => {
						member.send(new Discord.RichEmbed()
							.setColor(colour.blue)
							.setTitle(`Request to ${command} clan`)
							.setDescription(`Clan: ${clan}\nLeaders: ${func.mentionUsers(leaderid)}\nAwaiting confirmation from @${func.getRole(config.role.admin).name}`)
						);
					});
					return
				}
			});
		}

		if ((command === 'remove' || command === 'delete') && args[0] === 'match' && isadmin) {
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (clanA) (clanB)`)
			);
			let clanA = args[1];
			let clanB = args[2];
			if (clanA.toLowerCase() === clanB.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`State two different clans`)
			);
			pool.query('SELECT leaderid FROM clans WHERE clanname = ? OR clanname = ?; SELECT * FROM clanwars WHERE (winclan = ? AND loseclan = ?) OR (loseclan = ? AND winclan = ?) ORDER BY datetime DESC LIMIT 1', [clanA, clanB, clanA, clanB, clanA, clanB], (err, result) => {
				if (err) throw err;
				if (!result[1].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clans')
					.setDescription(`No past matches with these clans`)
				);
				let leaders = [].concat.apply([], result[0].map(x => { return x.leaderid.split(/\D+/g) }));
				let winner = result[1][0].winclan;
				let loser = result[1][0].loseclan;
				let winnerscore = result[1][0].winscore;
				let loserscore = result[1][0].losescore;
				let d = new Date(result[1][0].datetime + 'Z');
				pool.query('DELETE FROM clanwars WHERE winclan = ? AND loseclan = ? ORDER BY datetime DESC LIMIT 1', [winner, loser], (err) => {
					if (err) throw err;
					recalculateStats();
					updateMatchesMessage();
					message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle(`Match ${command}d: ${winner} vs ${loser} (${winnerscore}-${loserscore})`)
						.setDescription(`Date: ${dateFormat(d, 'UTC:dS mmmm, yyyy')}\nTime: ${dateFormat(d, "UTC:h:MMtt 'UTC'")}`)
					);
					leaders.forEach((id) => {
						let user = func.getUser(id);
						if (user) user.send(new Discord.RichEmbed()
							.setColor(colour.blue)
							.setTitle(`Match ${command}d: ${winner} vs ${loser} (${winnerscore}-${loserscore})`)
							.setDescription(`Date: ${dateFormat(d, 'UTC:dS mmmm, yyyy')}\nTime: ${dateFormat(d, "UTC:h:MMtt 'UTC'")}`)
						);
					});
					return;
				});
			});
		}

		if (command === 'remove' && (args[0] === 'member' || args[0] === 'members') && (isadmin || clanleader)) {
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (clan role) (users...)`)
			);
			let clan = args[1];
			let members = args.splice(2).map(x => func.getUser(x));
			let role = func.getRole(clan);
			if (!isadmin && clanleader.toLowerCase() !== clan.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`You can only remove members to your clan`)
			);
			if (!role) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`Clan role doesn't exist`)
			);
			members = members.filter(x => x && !x.user.bot);
			if (!members.length) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`Mention a user or use their ID or tag (abc#1234)`)
			);
			oldmembers = members.filter(x => func.userHasRole(x, role)).map(x => x.toString());
			members.forEach(x => x.removeRole(role));
			return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.blue)
				.setTitle(`${func.plural(oldmembers.length, 'Member')} removed`)
				.setDescription(`Clan: ${role.name}\n${func.plural(oldmembers.length, 'Member')}: ${(oldmembers.length) ? oldmembers.join(' ') : 'None'}`)
			);
		}

		if (command === 'change' && args[0] === 'clanname' && (isadmin || clanleader)) {
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (old name) (new name)`)
			);
			let oldname = args[1];
			let newname = args[2];
			if (!isadmin && clanleader.toLowerCase() !== oldname.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`You can only change the name of your clan`)
			);
			if (newname.length > 10) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan name')
				.setDescription('Maximum 10 characters')
			);
			pool.query('SELECT clanname, leaderid FROM clans WHERE clanname = ?; SELECT clanname, datetime FROM clans WHERE clanname = ?', [newname, oldname], (err, result) => {
				if (err) throw err;
				if (result[0].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan name')
					.setDescription(`Clan already exists\nClan: ${result[0][0].clanname}\nLeaders: ${func.mentionUsers(result[0][0].leaderid)}`)
				);
				oldname = result[1][0].clanname;
				let d = result[1][0].datetime;
				pool.query('UPDATE clans SET clanname = ? WHERE clanname = ?; UPDATE pending SET winclan = ? WHERE winclan = ?; UPDATE pending SET loseclan = ? WHERE loseclan = ?; UPDATE schedule SET clanA = ? WHERE clanA = ?; UPDATE schedule SET clanB = ? WHERE clanB = ?; UPDATE clanwars SET winclan = ? WHERE winclan = ? AND datetime > ?; UPDATE clanwars SET loseclan = ? WHERE loseclan = ? AND datetime > ?', [newname, oldname, newname, oldname, newname, oldname, newname, oldname, newname, oldname, newname, oldname, newname, d, oldname, d], (err) => {
					if (err) throw err;
					updateLeaderboardMessage();
					updateMatchesMessage();
					let role = func.getRole(oldname);
					if (role) role.setName(newname);
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Clan name changed')
						.setDescription(`Old name: ${oldname}\nNew name: ${newname}`)
					);
				});
			});
		}

		if (command === 'change' && args[0] === 'region' && (isadmin || clanleader)) {
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (clan) (new region)`)
			);
			let clan = args[1];
			let oldregion;
			let newregion = args[2].toUpperCase();
			if (!isadmin && clanleader.toLowerCase() !== clan.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`You can only change the region of your clan`)
			);
			if (!newregion.match(/^(AUS|EU|US)$/)) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid region')
				.setDescription(`Please specify either AUS, EU or US`)
			);
			pool.query('SELECT clanname, region FROM clans WHERE clanname = ?; UPDATE clans SET region = ? WHERE clanname = ?', [clan, newregion, clan], (err, result) => {
				if (err) throw err;
				if (!result[0].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`Clan doesn't exist`)
				);
				clan = result[0][0].clanname;
				oldregion = result[0][0].region;
				if (oldregion === newregion) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid region')
					.setDescription(`Region already set to ${oldregion}`)
				);
				return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.blue)
					.setTitle('Region changed')
					.setDescription(`Clan: ${clan}\nOld region: ${oldregion}\nNew region: ${newregion}`)
				);
			});
		}

		if (0 && command === 'change' && args[0] === 'leader' && (isadmin || clanleader)) { // Doesn't work with multiple leaders
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} ${args[0]} (clan) (new leader)`)
			);
			let clan = args[1];
			let oldleaderid;
			let newleader = func.getUser(args[2]);
			if (!isadmin && clanleader.toLowerCase() !== clan.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan')
				.setDescription(`You can only change the leader of your clan`)
			);
			if (!newleader) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`Mention the user or use their ID or tag (abc#1234)`)
			);
			if (newleader.user.bot) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid user')
				.setDescription(`A bot can't be the leader of a clan`)
			);
			pool.query('SELECT clanname, leader FROM clans WHERE clanname = ?; SELECT 1 FROM clans WHERE leaderid LIKE CONCAT("%", ?, "%")', [clan, newleader.id], (err, result) => {
				if (err) throw err;
				if (!result[0].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`Clan doesn't exist`)
				);
				clan = result[0][0].clanname;
				oldleaderid = result[0][0].leaderid;
				if (newleader.id === oldleaderid) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid user')
					.setDescription(`User is already the leader of this clan`)
				);
				if (result[1].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid user')
					.setDescription(`User is the leader of another clan`)
				);
				pool.query('UPDATE clans SET leaderid = ? WHERE clanname = ?', [newleader.id, clan], (err, result) => {
					if (err) throw err;
					updateLeaderboardMessage();
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Leader changed')
						.setDescription(`Clan: ${clan}\nOld leader: <@${oldleaderid}>\nNew leader: <@${newleader.id}>`)
					);
				});
			});
		}

		if ((command === 'report' || command === 'score') && clanleader) {
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (winning clan) (losing clan) (score: X-X)`)
			);
			let winclan = args[0];
			let loseclan = args[1];
			let score = args[2];
			if (!/^\d+-\d+$/g.test(score)) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid score')
				.setDescription(`Score should be formatted X-X`)
			);
			let winscore = score.split('-').sort()[1];
			let losescore = score.split('-').sort()[0];
			if (winscore > 10 || losescore > 10) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid score')
				.setDescription(`Score is way too large to be possible`)
			);
			if (winscore == 0 && losescore == 0) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid score')
				.setDescription(`Both clans can't have zero points`)
			);
			pool.query('SELECT 1 FROM clans WHERE clanname = ? OR clanname = ?; SELECT * FROM schedule WHERE (clanA = ? AND clanB = ?) OR (clanB = ? AND clanA = ?); SELECT 1 FROM pending WHERE (winclan = ? AND loseclan = ?) OR (loseclan = ? AND winclan = ?)', [winclan, loseclan, winclan, loseclan, winclan, loseclan, winclan, loseclan, winclan, loseclan], (err, result) => {
				if (err) throw err;
				if (result[0].length === 0) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clans')
					.setDescription(`Both clans don't exist`)
				);
				if (winclan.toLowerCase() === loseclan.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`You can't schedule a match against your own clan`)
				);
				if (result[0].length === 1) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`${(isadmin && args[1]) ? 'A c' : 'C'}lan doesn't exist`)
				);
				if (!result[1].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('No scheduled match')
					.setDescription(`There is no scheduled match between these clans`)
				);
				if (result[2].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Match already pending')
					.setDescription(`There is already a pending match between these clans`)
				);
				let d = new Date(result[1][0].datetime + 'Z');
				let now = new Date();
				if (now < d) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Cannot report match')
					.setDescription(`You can't report a match before the scheduled date/time`)
				);
				winclan = (result[1][0].clanA.toLowerCase() === winclan.toLowerCase()) ? result[1][0].clanA : result[1][0].clanB;
				loseclan = (result[1][0].clanA.toLowerCase() === loseclan.toLowerCase()) ? result[1][0].clanA : result[1][0].clanB;
				let pendingclan = (clanleader === loseclan) ? winclan : loseclan;
				pool.query('INSERT INTO pending (winclan, loseclan, winscore, losescore, datetime, pendingclan) VALUES (?, ?, ?, ?, ?, ?); SELECT leaderid FROM clans WHERE clanname = ?', [winclan, loseclan, winscore, losescore, dateFormat(d, 'isoUtcDateTime'), pendingclan, pendingclan], (err, result) => {
					if (err) throw err;
					updateMatchesMessage();
					let loseleaderid = result[1][0].leaderid;
					message.channel.send(new Discord.RichEmbed()
						.setColor(colour.orange)
						.setTitle(`Match pending: ${winclan} vs ${loseclan} (${winscore}-${losescore})`)
						.setDescription(`Awaiting confirmation from ${func.mentionUsers(loseleaderid)}`)
					);
					loseleaderid.split(/\D+/g).forEach((id) => {
						let user = func.getUser(id);
						if (user) user.send(new Discord.RichEmbed()
							.setColor(colour.orange)
							.setTitle(`Match pending: ${winclan} vs ${loseclan} (${winscore}-${losescore})`)
							.setDescription(`Awaiting your confirmation`)
						);
					})
					return;
				});
			});
		}

		if ((command === 'confirm' || command === 'accept') && (isadmin || clanleader)) {
			if (args.length < 1) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (clan)${(isadmin) ? `\n${config.prefix}${command} (clanA) (clanB) (actual score?) [admin only]` : ''}`)
			);
			let clanA = (isadmin) ? args[1] || clanleader : clanleader;
			let clanB = args[0];
			let score = args[2];
			let winscore;
			let losescore;
			if (!clanA) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (clanA) (clanB) (actual score?)`)
			);
			if (score) {
				if (!/^\d+-\d+$/g.test(score)) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid score')
					.setDescription(`Score should be formatted X-X`)
				);
				winscore = score.split('-').sort()[1];
				losescore = score.split('-').sort()[0];
				if (winscore > 10 || losescore > 10) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid score')
					.setDescription(`Score is way too large to be possible`)
				);
				if (winscore == 0 && losescore == 0) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid score')
					.setDescription(`Both clans can't have zero points`)
				);
			}
			pool.query('SELECT 1 FROM clans WHERE clanname = ? OR clanname = ?; SELECT * FROM pending WHERE (winclan = ? AND loseclan = ?) OR (loseclan = ? AND winclan = ?)', [clanA, clanB, clanA, clanB, clanA, clanB], (err, result) => {
				if (err) throw err;
				if (result[0].length === 0 && isadmin) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clans')
					.setDescription(`Both clans don't exist`)
				);
				if (clanA.toLowerCase() === clanB.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`State the clan you played against`)
				);
				if (result[0].length === 1) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`${(isadmin && args[1]) ? 'A c' : 'C'}lan doesn't exist`)
				);
				if (!result[1].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`No pending matches against that clan`)
				);
				if (result[1][0].pendingclan !== clanA && !isadmin) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Cannot confirm match')
					.setDescription(`The opposing clan needs to confirm/reject the match`)
				);
				let winner = {
					clan: result[1][0].winclan,
					score: winscore || result[1][0].winscore,
					oldelo: undefined,
					newelo: undefined,
					elochange: undefined,
					oldrank: undefined,
					newrank: undefined,
					rankchange: undefined
				};
				let loser = {
					clan: result[1][0].loseclan,
					score: losescore || result[1][0].losescore,
					oldelo: undefined,
					newelo: undefined,
					elochange: undefined,
					oldrank: undefined,
					newrank: undefined,
					rankchange: undefined
				};
				let d = new Date(result[1][0].datetime + 'Z');
				pool.query('SELECT clanname, elo, (wins + losses + draws) AS matches FROM clans ORDER BY elo DESC, (wins / (wins + losses) * 100) DESC, clanname ASC; INSERT INTO clanwars SELECT winclan, loseclan, winscore, losescore, datetime FROM pending WHERE winclan = ? AND loseclan = ?; DELETE FROM pending WHERE winclan = ? AND loseclan = ?; DELETE FROM schedule WHERE (clanA = ? AND clanB = ?) OR (clanB = ? AND clanA = ?)', [winner.clan, loser.clan, winner.clan, loser.clan, winner.clan, loser.clan, winner.clan, loser.clan], (err, result) => {
					if (err) throw err;
					winner.oldelo = result[0].find(x => x.clanname === winner.clan).elo;
					loser.oldelo = result[0].find(x => x.clanname === loser.clan).elo;
					result[0] = result[0].filter(x => x.matches);
					winner.oldrank = result[0].findIndex(x => x.clanname === winner.clan) + 1;
					loser.oldrank = result[0].findIndex(x => x.clanname === loser.clan) + 1;
					updateMatchesMessage();
					recalculateStats((result) => {
						winner.newelo = result.find(x => x.clanname === winner.clan).elo;
						loser.newelo = result.find(x => x.clanname === loser.clan).elo;
						winner.newrank = result.findIndex(x => x.clanname === winner.clan) + 1;
						loser.newrank = result.findIndex(x => x.clanname === loser.clan) + 1;
						winner.elochange = winner.newelo - winner.oldelo;
						loser.elochange = loser.newelo - loser.oldelo;
						winner.rankchange = (winner.oldrank) ? winner.oldrank - winner.newrank : 0;
						loser.rankchange = (loser.oldrank) ? loser.oldrank - loser.newrank : 0;
						return message.channel.send(new Discord.RichEmbed()
							.setColor(colour.green)
							.setTitle(`Match confirmed: ${winner.clan} vs ${loser.clan} (${winner.score}-${loser.score})`)
							.setDescription(`${dateFormat(d, "UTC:dddd dS mmmm, yyyy 'at' h:MMtt 'UTC'")}`)
							.addField(winner.clan, `Rank: #${winner.newrank}${func.numbArrow(winner.rankchange)}\nElo: ${Math.round(winner.newelo)}${func.numbSign(Math.round(winner.elochange))}`, 1)
							.addField(loser.clan, `Rank: #${loser.newrank}${func.numbArrow(loser.rankchange)}\nElo: ${Math.round(loser.newelo)}${func.numbSign(Math.round(loser.elochange))}`, 1)
						);
					});
				});
			});
		}

		if ((command === 'reject' || command === 'deny') && (isadmin || clanleader)) {
			if (args.length < 1) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (clan)${(isadmin) ? `\n${config.prefix}${command} (clanA) (clanB) [admin only]` : ''}`)
			);
			let clanA = (isadmin) ? args[1] || clanleader : clanleader;
			let clanB = args[0];
			if (!clanA) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (clanA) (clanB)`)
			);
			pool.query('SELECT 1 FROM clans WHERE clanname = ? OR clanname = ?; SELECT * FROM pending WHERE (winclan = ? AND loseclan = ?) OR (loseclan = ? AND winclan = ?)', [clanA, clanB, clanA, clanB, clanA, clanB], (err, result) => {
				if (err) throw err;
				if (result[0].length === 0 && isadmin) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clans')
					.setDescription(`Both clans don't exist`)
				);
				if (clanA.toLowerCase() === clanB.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`State the clan you played against`)
				);
				if (result[0].length === 1) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`${(isadmin && args[1]) ? 'A c' : 'C'}lan doesn't exist`)
				);
				if (!result[1].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`No pending matches against that clan`)
				);
				if (result[1][0].pendingclan !== clanA && !isadmin) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Cannot reject match')
					.setDescription(`The opposing clan needs to confirm/reject the match`)
				);
				if (isadmin) {
					pool.query('DELETE FROM pending WHERE (winclan = ? AND loseclan = ?) OR (loseclan = ? AND winclan = ?); DELETE FROM schedule WHERE (clanA = ? AND clanB = ?) OR (clanB = ? AND clanA = ?)', [clanA, clanB, clanA, clanB, clanA, clanB, clanA, clanB], (err) => {
						if (err) throw err;
						updateMatchesMessage();
						return message.channel.send(new Discord.RichEmbed()
							.setColor(colour.red)
							.setTitle(`Match rejected: ${result[1][0].winclan} vs ${result[1][0].loseclan} (${result[1][0].winscore}-${result[1][0].losescore})`)
							.setDescription(`Next time let's hope both clans agree on the result`)
						);
					});
				} else {
					message.channel.send(new Discord.RichEmbed()
						.setColor(colour.orange)
						.setTitle(`Request to reject match: ${result[1][0].winclan} vs ${result[1][0].loseclan} (${result[1][0].winscore}-${result[1][0].losescore})`)
						.setDescription(`Awaiting confirmation from <@&${config.role.admin}>`)
					);
					let adminrole = func.getRole(config.role.admin);
					if (adminrole) adminrole.members.forEach((member) => {
						member.send(new Discord.RichEmbed()
							.setColor(colour.orange)
							.setTitle(`Request to reject match: ${result[1][0].winclan} vs ${result[1][0].loseclan} (${result[1][0].winscore}-${result[1][0].losescore})`)
							.setDescription(`!confirm if the team is being salty and the score is correct\n!confirm with a new score if the score is incorrect\n!reject if both teams can't agree on the score`)
						);
					});
					return;
				}
			});
		}

		if (command === 'schedule' && clanleader) {
			if (args.length < 3) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (clan) (date: DD/MM/YY) (24h UTC time: HH:MM)`)
			);
			let clanA = clanleader;
			let clanB = args[0];
			let clanBleaderid;
			if (!/^\d\d?\/\d\d?\/\d\d$/g.test(args[1])) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid date')
				.setDescription(`Date should be formatted DD/MM/YY`)
			);
			if (!/^\d+:\d\d$/g.test(args[2])) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid time')
				.setDescription(`Time should be 24h UTC and formatted HH:MM`)
			);
			let date = args[1].split('/');
			let time = args[2].split(':');
			let d = new Date(Date.UTC('20' + date[2], date[1] - 1, date[0], time[0], time[1]));
			let now = new Date();
			let lowerclash = new Date(d.getTime() - config.vars.clashTime * 60000);
			let upperclash = new Date(d.getTime() + config.vars.clashTime * 60000);
			pool.query('SELECT clanname, leaderid FROM clans WHERE clanname = ?; SELECT 1 FROM schedule WHERE (clanA = ? AND clanB = ?) OR (clanB = ? AND clanA = ?); SELECT * FROM schedule WHERE datetime > ? AND datetime < ? ORDER BY ABS(DATEDIFF(datetime, ?)) LIMIT 1', [clanB, clanA, clanB, clanA, clanB, dateFormat(lowerclash, 'isoUtcDateTime'), dateFormat(upperclash, 'isoUtcDateTime'), dateFormat(d, 'isoUtcDateTime')], (err, result) => {
				if (err) throw err;
				if (!result[0].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`Clan doesn't exist`)
				);
				clanB = result[0][0].clanname;
				clanBleaderid = result[0][0].leaderid;
				if (clanA === clanB) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`You can't schedule a match against your own clan`)
				);
				if (result[1].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Match already scheduled')
					.setDescription(`There is already a match scheduled against this clan`)
				);
				if (d < now) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid date/time')
					.setDescription(`The date and time you specified is in the past`)
				);
				if (now.setMonth(now.getMonth() + 1) < d) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid date/time')
					.setDescription(`The date and time you specified is too far away\nSchedule the match for within 1 month from now`)
				);
				if (result[2].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid date/time')
					.setDescription(`The date and time you specified clashes with another scheduled match\nSchedule the match so there is ${config.vars.clashTime} minutes to spare`)
				);
				pool.query('INSERT INTO schedule (clanA, clanB, datetime) VALUES (?, ?, ?)', [clanA, clanB, dateFormat(d, 'isoUtcDateTime')], (err) => {
					if (err) throw err;
					updateMatchesMessage();
					message.channel.send(new Discord.RichEmbed()
						.setColor(colour.green)
						.setTitle(`Match scheduled: ${clanA} vs ${clanB}`)
						.setDescription(`Date: ${dateFormat(d, 'UTC:dS mmmm, yyyy (dddd)')}\nTime: ${dateFormat(d, "UTC:h:MMtt 'UTC'")}`)
					);
					let clanBleader = func.getUser(clanBleaderid);
					if (clanBleader) clanBleader.send(new Discord.RichEmbed()
						.setColor(colour.green)
						.setTitle(`Match scheduled: ${clanA} vs ${clanB}`)
						.setDescription(`Date: ${dateFormat(d, 'UTC:dS mmmm, yyyy (dddd)')}\nTime: ${dateFormat(d, "UTC:h:MMtt 'UTC'")}`)
					);
					return;
				});
			});
		}

		if (command === 'cancel' && (isadmin || clanleader)) {
			if (args.length < 1) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (clan)${(isadmin) ? `\n${config.prefix}${command} (clanA) (clanB) [admin only]` : ''}`)
			);
			let clanA = (isadmin) ? args[1] || clanleader : clanleader;
			let clanB = args[0]
			if (!clanA) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (clanA) (clanB)`)
			);
			pool.query('SELECT 1 FROM clans WHERE clanname = ? OR clanname = ?; SELECT 1 FROM pending WHERE (winclan = ? AND loseclan = ?) OR (loseclan = ? AND winclan = ?); SELECT * FROM schedule WHERE (clanA = ? AND clanB = ?) OR (clanB = ? AND clanA = ?)', [clanA, clanB, clanA, clanB, clanA, clanB, clanA, clanB, clanA, clanB], (err, result) => {
				if (err) throw err;
				if (result[0].length === 0 && isadmin) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clans')
					.setDescription(`Both clans don't exist`)
				);
				if (clanA.toLowerCase() === clanB.toLowerCase()) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`State the clan you're scheduled to play against`)
				);
				if (result[0].length === 1) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`${(isadmin && args[1]) ? 'A c' : 'C'}lan doesn't exist`)
				);
				if (result[1].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Match currently pending')
					.setDescription(`The match is currently pending, therefore you can't cancel it`)
				);
				if (!result[2].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('No scheduled match')
					.setDescription(`There is no scheduled match with that clan`)
				);
				clanA = result[2][0].clanA;
				clanB = result[2][0].clanB;
				let otherclan = (result[2][0].clanA === clanleader) ? result[2][0].clanB : result[2][0].clanA;
				let d = new Date(result[2][0].datetime + 'Z');
				let now = new Date();
				if (!isadmin && now > d) {
					message.channel.send(new Discord.RichEmbed()
						.setColor(colour.orange)
						.setTitle(`Request to cancel match: ${clanA} vs ${clanB}`)
						.setDescription(`Date: ${dateFormat(d, 'UTC:dS mmmm, yyyy (dddd)')}\nTime: ${dateFormat(d, "UTC:h:MMtt 'UTC'")}\nAwaiting confirmation from <@&${config.role.admin}>`)
					);
					let adminrole = func.getRole(config.role.admin);
					if (adminrole) adminrole.members.forEach((member) => {
						member.send(new Discord.RichEmbed()
							.setColor(colour.orange)
							.setTitle(`Request to cancel match: ${clanA} vs ${clanB}`)
							.setDescription(`Date: ${dateFormat(d, 'UTC:dS mmmm, yyyy (dddd)')}\nTime: ${dateFormat(d, "UTC:h:MMtt 'UTC'")}`)
						);
					});
				} else {
					pool.query('DELETE FROM schedule WHERE clanA = ? AND clanB = ?; SELECT leaderid FROM clans WHERE clanname = ?', [clanA, clanB, otherclan], (err, result) => {
						if (err) throw err;
						updateMatchesMessage();
						message.channel.send(new Discord.RichEmbed()
							.setColor(colour.red)
							.setTitle(`Match cancelled: ${clanA} vs ${clanB}`)
							.setDescription(`Date: ${dateFormat(d, 'UTC:dS mmmm, yyyy (dddd)')}\nTime: ${dateFormat(d, "UTC:h:MMtt 'UTC'")}`)
						);
						let otherleader = result[1][0].leaderid;
						otherleader.split(/\D+/g).forEach((id) => {
							let user = func.getUser(id);
							if (user) user.send(new Discord.RichEmbed()
								.setColor(colour.red)
								.setTitle(`Match cancelled: ${clanA} vs ${clanB}`)
								.setDescription(`Date: ${dateFormat(d, 'UTC:dS mmmm, yyyy (dddd)')}\nTime: ${dateFormat(d, "UTC:h:MMtt 'UTC'")}`)
							);
						})
						return;
					});
				}
			});
		}

		if (command === 'clans') {
			pool.query('SELECT clanname, leaderid, region FROM clans ORDER BY region, clanname', (err, result) => {
				if (err) throw err;
				if (!result.length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('No clans')
					.setDescription(`There are no clans`)
				);
				return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.blue)
					.addField(`Clans (${result.length})`, result.map(x => x.clanname).join('\n'), 1)
					.addField('Region　　Leaders', result.map(x => `${x.region + ((x.region !== 'AUS') ? '   ' : '')}　　　${func.mentionUsers(x.leaderid)}`).join('\n'), 1)
				);
			});
		}

		if (command === 'stats') {
			let clan = args[0] || clanleader;
			if (!clan) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (clan)`)
			);
			pool.query('SELECT *, (wins / (wins + losses) * 100) AS winrate FROM clans WHERE clanname = ?; SELECT * FROM clanwars WHERE (winclan = ? OR loseclan = ?) AND datetime > (SELECT datetime FROM clans WHERE clanname = ?) ORDER BY datetime DESC LIMIT 5', [clan, clan, clan, clan], (err, result) => {
				if (err) throw err;
				if (!result[0].length) return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.red)
					.setTitle('Invalid clan')
					.setDescription(`Clan doesn't exist`)
				);
				let info = result[0][0];
				let matches = result[1];
				return message.channel.send(new Discord.RichEmbed()
					.setColor(colour.blue)
					.addField(`Clan stats: ${info.clanname}`, `Wins: ${info.wins}\nLosses: ${info.losses}\nDraws: ${info.draws}\nWinrate: ${Math.round(info.winrate)}%\nElo: ${Math.round(info.elo)}`, 1)
					.addField(`Past matches (${matches.length})`, matches.map(x => `${dateFormat(new Date(x.datetime), 'dS mmm')}: ${x.winclan} vs ${x.loseclan} (${x.winscore}-${x.losescore})`).join('\n') || 'None', 1)
				);
			});
		}

		if (command === 'members') {
			let clan = args[0] || clanleader;
			if (!clan) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}stats (clan)`)
			);
			let role = func.getRole(clan);
			if (!role) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid clan role')
				.setDescription(`Clan role doesn't exist`)
			);
			let members = role.members.array().map(x => x.toString());
			return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.blue)
				.addField(`Clan members: ${role.name}`, (members.length > 0) ? members.join(' ') : 'None')
			);
		}

		if (command === 'reset' && isadmin) {
			if (args.length < 1 || args[0].search(/^(stats|clans|pending|matches|schedule|all)$/i) === -1) return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.red)
				.setTitle('Invalid command arguments')
				.setDescription(`${config.prefix}${command} (stats/clans/pending/matches/schedule/all)`)
			);
			if (args[0] === 'stats') {
				pool.query('UPDATE clans SET datetime = DEFAULT', (err) => {
					if (err) throw err;
					recalculateStats();
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Stats reset')
						.setDescription(`The stats of all clans has been reset`)
					);
				});
			}
			if (args[0] === 'clans') {
				pool.query('SELECT clanname FROM clans; DELETE FROM clans; DELETE FROM pending; DELETE FROM schedule', (err, result) => {
					if (err) throw err;
					updateLeaderboardMessage();
					updateMatchesMessage();
					result[0].forEach(clan => {
						let role = func.getRole(clan.clanname);
						if (role) role.delete();
					})
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Clans reset')
						.setDescription(`All clans, including pending and scheduled matches, have been cleared`)
					);
				});
			}
			if (args[0] === 'pending') {
				pool.query('DELETE FROM pending', (err) => {
					if (err) throw err;
					updateMatchesMessage();
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Pending matches reset')
						.setDescription(`All pending matches have been cleared`)
					);
				});
			}
			if (args[0] === 'matches') {
				pool.query('DELETE FROM clanwars', (err) => {
					if (err) throw err;
					recalculateStats();
					updateMatchesMessage();
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Past matches reset')
						.setDescription(`All past matches, including clan stats, have been cleared`)
					);
				});
			}
			if (args[0] === 'schedule') {
				pool.query('DELETE FROM schedule; DELETE FROM pending;', (err) => {
					if (err) throw err;
					updateMatchesMessage();
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Schedule reset')
						.setDescription(`All scheduled matches, including pending matches, have been cleared`)
					);
				});
			}
			if (args[0] === 'all') {
				pool.query('SELECT clanname FROM clans; DELETE FROM clans; DELETE FROM pending; DELETE FROM clanwars; DELETE FROM schedule', (err, result) => {
					if (err) throw err;
					updateLeaderboardMessage();
					updateMatchesMessage();
					result[0].forEach(clan => {
						let role = func.getRole(clan.clanname);
						if (role) role.delete();
					})
					return message.channel.send(new Discord.RichEmbed()
						.setColor(colour.blue)
						.setTitle('Everything reset')
						.setDescription(`FULL RESET! Time to start anew`)
					);
				});
			}
		}

		if ((command === 'reload' || command === 'refresh') && isadmin) {
			recalculateStats();
			updateMatchesMessage();
			return message.channel.send(new Discord.RichEmbed()
				.setColor(colour.blue)
				.setTitle(`Panels ${command}ed`)
				.setDescription(`The leaderboard and matches panels have been ${command}ed`)
			);
		}
	});
});

client.on('guildMemberRemove', (member) => {
	pool.query('SELECT clanname FROM clans WHERE leaderid LIKE CONCAT("%", ?, "%")', [member.id], (err, result) => {
		if (err) throw err;
		let channel = func.getChannel(config.channel.general);
		if (result.length && channel) return channel.send(`<@${member.id}>, the leader of ${result[0].clanname}, has left the server <@&${config.role.admin}>`)
	});
});

client.on('guildMemberAdd', (member) => {
	pool.query('SELECT clanname FROM clans WHERE leaderid LIKE CONCAT("%", ?, "%")', [member.id], (err, result) => {
		if (err) throw err;
		let channel = func.getChannel(config.channel.general);
		if (result.length && channel) return channel.send(`<@${member.id}>, the leader of ${result[0].clanname}, has returned <@&${config.role.admin}>`)
	});
});

function updateLeaderboardMessage() {
	if (!messages.leaderboard) return;
	pool.query('SELECT *, (wins / (wins + losses) * 100) AS winrate FROM clans WHERE (wins + losses + draws) > 0 ORDER BY elo DESC, winrate DESC, clanname ASC LIMIT 20', (err, result) => {
		if (err) throw err;
		let text = '```md\n# Clan leaderboard``````diff\n++|   Clan   |Region| Wins |Losses| Draws|Winrate| Elo';
		for (i = 0; i < result.length; i++) {
			text += `\n${func.alignText(i + 1, 2, 1)}|${func.alignText(result[i].clanname, 10, 0)}|  ${result[i].region.substr(0, 2)}  | ${func.alignText(result[i].wins, 3, 1)}  | ${func.alignText(result[i].losses, 3, 1)}  | ${func.alignText(result[i].draws, 3, 1)}  | ${func.alignText(Math.round(result[i].winrate), 3, 1)}%  |${func.alignText(Math.round(result[i].elo), 4, 1)}`;
		}
		text += '```';
		return messages.leaderboard.edit(text).catch((err) => {
			return console.log(`ERROR: Leaderboard message too long (${text.length} characters)`);
		});
	});
}

function updateMatchesMessage() {
	if (!messages.matches) return;
	pool.query('SELECT * FROM clanwars ORDER BY datetime DESC LIMIT 10; SELECT * FROM pending LIMIT 10; SELECT * FROM schedule ORDER BY datetime ASC LIMIT 10; SELECT COUNT(*) AS total FROM clanwars; SELECT COUNT(*) AS total FROM pending; SELECT COUNT(*) AS total FROM schedule', (err, result) => {
		if (err) throw err;
		let matches = result[0];
		let pending = result[1];
		let schedule = result[2];
		let totalmatches = result[3][0].total;
		let totalpending = result[4][0].total;
		let totalschedule = result[5][0].total;
		let width = 42;

		// let text = '```md\n' + `${func.alignText(`# Past matches (${totalmatches})`, width, -1)}  | ${func.alignText(`# Pending matches (${totalpending})`, width, -1)} | # Scheduled matches (${totalschedule})` + '``````diff\n';
		// for (i = 0; i < Math.min(Math.max(matches.length, pending.length, schedule.length), 10); i++) {
		// 	text += `\n${func.alignText((matches[i]) ? `${dateFormat(new Date(matches[i].datetime + 'Z'), 'UTC:dS mmm')}: ${matches[i].winclan} vs ${matches[i].loseclan} (${matches[i].winscore}-${matches[i].losescore})` : '', width, -1)}  |`;
		// 	text += ` ${func.alignText((pending[i]) ? `${pending[i].winclan} vs ${pending[i].loseclan} (${pending[i].winscore}-${pending[i].losescore})` : '', width, -1)} |`;
		// 	text += (schedule[i]) ? ` ${dateFormat(new Date(schedule[i].datetime + 'Z'), "UTC:dS mmm h:MMtt 'UTC'")}: ${schedule[i].clanA} vs ${schedule[i].clanB}` : '';
		// }
		// text += '\n```';

		let text = '```md\n' + `# Scheduled matches (${totalschedule})` + '``````diff';
		if (!schedule.length) text += '\n​';
		for (let i = 0; i < schedule.length; i++) {
			let d = new Date(schedule[i].datetime + 'Z');
			let now = new Date();
			let o = new Date(d.getTime() + config.vars.overdueTime * 60000);
			text += `\n${(now > d) ? (now > o) ? '- ' : '+ ' : ''}${dateFormat(d, "UTC:dS mmm h:MMtt 'UTC'")}: ${schedule[i].clanA} vs ${schedule[i].clanB}`;
		}
		text += '```\n```md\n' + `# Pending matches (${totalpending})` + '``````diff';
		if (!pending.length) text += '\n​';
		for (let i = 0; i < pending.length; i++) {
			text += `\n${pending[i].winclan} vs ${pending[i].loseclan} (${pending[i].winscore}-${pending[i].losescore}) [${pending[i].pendingclan}]`;
		}
		text += '```\n```md\n' + `# Past matches (${totalmatches})` + '``````diff';
		if (!matches.length) text += '\n​';
		for (let i = 0; i < matches.length; i++) {
			let d = new Date(matches[i].datetime + 'Z');
			text += `\n${dateFormat(d, 'UTC:dS mmm')}: ${matches[i].winclan} vs ${matches[i].loseclan} (${matches[i].winscore}-${matches[i].losescore})`;
		}
		text += '```';

		messages.matches.edit(text).catch((err) => {
			return console.log(`ERROR: Matches message too long (${text.length} characters)`);
		});
	});
}

function scheduleLoop() {
	if (!messages.matches) return;
	let now = new Date();
	now.setSeconds(0);
	now.setMilliseconds(0);
	pool.query('SELECT * FROM schedule ORDER BY datetime ASC', (err, result) => {
		if (err) throw err;
		let updateMatches = false;
		for (i = 0; i < result.length; i++) {
			let clanA = result[i].clanA;
			let clanB = result[i].clanB;
			let d = new Date(result[i].datetime + 'Z');
			let overdue = new Date(d.getTime() + config.vars.overdueTime * 60000);
			let notify = new Date(d.getTime() - config.vars.notifyTime * 60000);
			// Running and overdue matches
			if (now.getTime() === d.getTime() || now.getTime() === overdue.getTime()) {
				updateMatches = true;
			}
			// Reminder notification
			if (now.getTime() === notify.getTime()) {
				pool.query('SELECT leaderid FROM clans WHERE clanname = ? OR clanname = ?', [result[0].clanA, result[0].clanB], (err, result) => {
					if (err) throw err;
					for (let j = 0; j < result.length; j++) {
						let leader = result[j].leaderid;
						leader.split(/\D+/g).forEach((id) => {
							let user = func.getUser(id);
							if (user) user.send(new Discord.RichEmbed()
								.setColor(colour.blue)
								.setTitle(`Match reminder: ${clanA} vs ${clanB} (${config.vars.notifyTime} ${func.plural(config.vars.notifyTime, 'min')})`)
								.setDescription(`The match is scheduled to start at ${dateFormat(d, "UTC:h:MMtt 'UTC'")}\nBegin to get your team organised so it starts on time`)
							);
						});
					}
				});
			}
			// Match start alert
			if (now.getTime() === d.getTime()) {
				let channel = func.getChannel(config.channel.general);
				new Discord.Message().embeds
				if (channel) channel.send(new Discord.RichEmbed()
					.setColor(colour.blue)
					.setTitle(`Match started: ${clanA} vs ${clanB}`)
					.setDescription(`The match is scheduled to start now\nDont forget to report the score after the match`)
				);
			}
			// Overdue alert
			if (now.getTime() === overdue.getTime()) {
				pool.query('SELECT leaderid FROM clans WHERE clanname = ? OR clanname = ?', [result[0].clanA, result[0].clanB], (err, result) => {
					if (err) throw err;
					for (let j = 0; j < result.length; j++) {
						let user = func.getUser(result[j].leaderid);
						if (user) user.send(new Discord.RichEmbed()
							.setColor(colour.orange)
							.setTitle(`Match overdue: ${clanA} vs ${clanB}`)
							.setDescription(`The match was scheduled to start at ${dateFormat(d, "UTC:h:MMtt 'UTC'")}\nPlease report the match results or cancel the scheduled match if it didn't happen`)
						);
					}
				});
			}
		}
		if (updateMatches) updateMatchesMessage();
	});
	let delay = 60000 - new Date() % 60000;
	setTimeout(scheduleLoop, delay);
};

function recalculateStats(callback) {
	pool.query('SELECT *, 0 AS wins, 0 AS losses, 0 AS draws, DEFAULT(elo) AS elo FROM clans; SELECT * FROM clanwars ORDER BY datetime ASC', (err, result) => {
		if (err) throw err;
		let clans = result[0];
		let allclans = [];
		let matches = result[1];
		if (!clans.length) {
			return (callback) ? callback() : false;
		}
		let defaultelo = clans[0].elo;

		for (let i = 0; i < matches.length; i++) {
			let winclan = matches[i].winclan;
			let loseclan = matches[i].loseclan;
			let wd = clans.find((clan) => { return clan.clanname === winclan });
			let ld = clans.find((clan) => { return clan.clanname === loseclan });
			wd = (wd) ? new Date(wd.datetime + 'Z') : 0;
			ld = (ld) ? new Date(ld.datetime + 'Z') : 0;
			let d = new Date(matches[i].datetime + 'Z');
			let winindex = allclans.findIndex((clan) => { return clan.clanname === winclan });
			let loseindex = allclans.findIndex((clan) => { return clan.clanname === loseclan });
			if (winindex === -1) {
				allclans.push({
					clanname: winclan,
					wins: 0,
					losses: 0,
					draws: 0,
					elo: defaultelo
				});
				winindex = allclans.length - 1;
			}
			if (loseindex === -1) {
				allclans.push({
					clanname: loseclan,
					wins: 0,
					losses: 0,
					draws: 0,
					elo: defaultelo
				});
				loseindex = allclans.length - 1;
			}
			let elo = func.elo(allclans[winindex].elo, allclans[loseindex].elo, matches[i].winscore, matches[i].losescore);
			if (d > wd) allclans[winindex].elo = elo.eloA;
			if (d > ld) allclans[loseindex].elo = elo.eloB;
			if (matches[i].winscore === matches[i].losescore) {
				if (d > wd) allclans[winindex].draws++;
				if (d > ld) allclans[loseindex].draws++;
			} else {
				if (d > wd) allclans[winindex].wins++;
				if (d > ld) allclans[loseindex].losses++;
			}
		}
		for (let i = 0; i < allclans.length; i++) {
			let clanindex = clans.findIndex((clan) => { return clan.clanname === allclans[i].clanname });
			if (clanindex === -1) continue;
			for (let j in clans[clanindex]) {
				clans[clanindex][j] = allclans[i][j] || clans[clanindex][j];
			}
		}
		pool.query('DELETE FROM clans; INSERT INTO clans (clanname, leaderid, wins, losses, draws, elo, datetime, region) VALUES ?', [clans.map(x => { return Object.values(x) })], (err) => {
			if (err) throw err;
			updateLeaderboardMessage();
			clans = clans.filter(x => x.wins + x.losses + x.draws).sort((a, b) => {
				if (a.elo === b.elo) {
					let awinrate = a.wins / (a.wins + a.losses) * 100
					let bwinrate = b.wins / (b.wins + b.losses) * 100;
					if (awinrate === bwinrate) {
						return a.clanname.toLowerCase().localeCompare(b.clanname.toLowerCase());
					}
					return bwinrate - awinrate;
				}
				return b.elo - a.elo;
			});
			if (callback) return callback(clans);
		});
	});
}

client.login(config.token);