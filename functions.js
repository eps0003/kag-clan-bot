const config = require('./config.json');
const index = require('./index.js');

module.exports = {
	/**
	 * Converts role ID, role name, role mention or role object into a role object
	 * @param {*} role
	 */
	getRole(role) {
		if (typeof role === 'object') return role;
		if (/<@&\d+>/.test(role) || !isNaN(role)) { // Mention or ID
			role = index.client.guilds.get(config.guild).roles.get(role.match(/\d+/)[0]);
		} else { // Name
			role = index.client.guilds.get(config.guild).roles.find(x => x.name.toLowerCase() === role.toLowerCase());
		}
		return role || null;
	},

	/**
	 * Converts user ID, user tag, user mention or user object into a user object
	 * @param {*} user
	 */
	getUser(user) {
		if (typeof user === 'object') return user;
		if (/<@!?\d+>/.test(user) || !isNaN(user)) { // Mention or ID
			user = index.client.guilds.get(config.guild).members.get(user.match(/\d+/)[0]);
		} else if (/.+#\d{4}$/.test(user)) { // Tag
			user = index.client.guilds.get(config.guild).members.array().find(x => user === `${x.user.username}#${x.user.discriminator}`);
		} else { // Name
			let guildMembers = index.client.guilds.get(config.guild).members;
			user = guildMembers.find(x => x.user.username.toLowerCase() === user.toLowerCase())
				|| guildMembers.find(x => (x.nickname || x.user.username).toLowerCase() === user.toLowerCase())
				|| guildMembers.find(x => x.user.username.toLowerCase().includes(user.toLowerCase()))
				|| guildMembers.find(x => (x.nickname || x.user.username).toLowerCase().includes(user.toLowerCase()));
		}
		return user || null;
	},

	/**
     * Gets the channel object
     * @param {*} channel
     */
	getChannel(channel) {
		if (typeof channel === 'object') return channel;
		return index.client.guilds.get(config.guild).channels.get(channel) || null;
	},

	/**
	 * Checks if the specified user has the specified role
	 * @param {*} user
	 * @param {*} role
	 */
	userHasRole(user, role) {
		user = this.getUser(user);
		role = this.getRole(role);
		if (!user || !role) return false;
		return index.client.guilds.get(config.guild).members.get(user.id).roles.has(role.id);
	},

	/**
	 * Calculates and returns objedt with new elo score of both teams
	 * @param {number} eloA
	 * @param {number} eloB
	 * @param {number} scoreA
	 * @param {number} scoreB
	 */
	elo(eloA, eloB, scoreA, scoreB) {
		let k = 48;

		let ea = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
		let eb = 1 / (1 + Math.pow(10, (eloA - eloB) / 400));

		let sa = (scoreA - scoreB) / (Math.max(scoreA, scoreB) * 2) + 0.5;
		let sb = (scoreB - scoreA) / (Math.max(scoreA, scoreB) * 2) + 0.5;

		let ra = eloA + k * (sa - ea);
		let rb = eloB + k * (sb - eb);

		return { eloA: ra, eloB: rb };
	},

	/**
	 * Returns the number with its sign (+/-) before it
	 * @param {number} number
	 */
	numbSign(number) {
		return (number) ? (number > 0) ? ` ( + ${number} )` : ` ( - ${Math.abs(number)} )` : '';
	},

	/**
	 * Returns an arrow (↑/↓) with the difference of the values specified
	 * @param {number} number
	 */
	numbArrow(number) {
		return (number) ? (number > 0) ? ` (▴${number} )` : ` (▾${Math.abs(number)} )` : '';
	},

	/**
     * Aligns the specified text to the left, right or centre of the specified width
     * @param {string} text
     * @param {number} width
     * @param {number} align
     * @param {string} padChar
     */
	alignText(text, width, align, padChar = ' ') {
		text = text.toString();
		if (text.length > width) return text.substr(0, width - 1) + '…';
		width -= text.length;
		if (align < 0) return text + padChar.repeat(width);
		if (align > 0) return padChar.repeat(width) + text;
		width /= 2;
		return padChar.repeat(Math.floor(width)) + text + padChar.repeat(Math.ceil(width));
	},

	/**
	 * Lists each user as a mention
	 * @param {*} userids
	 */
	mentionUsers(userids) {
		if (typeof userids === 'string') userids = userids.split(/\D+/g);
		return userids.map(id => `<@${id}>`).join(' ');
	},

	/**
	 * Pluralises the specified string with the optional suffix depending on the given value
	 * @param {number} val
	 * @param {string} text
	 * @param {string} suffix
	 */
	plural(val, text, suffix = 's') {
		return val === 1 ? text : text + suffix;
	},
}