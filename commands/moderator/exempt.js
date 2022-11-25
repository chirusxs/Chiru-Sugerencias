const { dbModify } = require("../../utils/db");
const { baseConfig } = require("../../utils/checks");
const { serverLog } = require("../../utils/logs");
const { fetchUser } = require("../../utils/misc.js");
const { string } = require("../../utils/strings");
module.exports = {
	controls: {
		name: "eximir",
		permission: 3,
		usage: "eximir [miembro]",
		description: "Exime a alguien del tiempo de espera para enviar sugerencias",
		enabled: true,
		examples: "`{{p}}eximir @Chiruso`\nExime a Chiruso del tiempo de espera\n\n`{{p}}eximir 851072040189427722`\nExime a Chiruso usando su Id. del tiempo de espera",
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "USE_EXTERNAL_EMOJIS", "EMBED_LINKS", "ADD_REACTIONS"],
		cooldown: 5,
		docs: "staff/exempt"
	},
	do: async (locale, message, client, args, Discord) => {
		let [returned, qServerDB] = await baseConfig(locale, message.guild);
		if (returned) return message.channel.send(returned);
		let guildLocale = qServerDB.config.locale;

		if (!args[0]) return message.channel.send(string(locale, "EXEMPT_NO_ARGS_ERROR", {}, "error"));

		let user = await fetchUser(args[0], client);
		if (!user || user.id === "0") return message.channel.send(string(locale, "INVALID_USER_ERROR", {}, "error"));

		if (user.bot) return message.channel.send(string(locale, "EXEMPT_USER_BOT_ERROR", {}, "error"));

		await message.guild.members.fetch(user.id).catch(() => {});
		if (!message.guild.members.cache.get(user.id)) return message.channel.send(string(locale, "EXEMPT_USER_NOT_MEMBER_ERROR", {}, "error"));
		if (qServerDB.config.cooldown_exempt.includes(user.id)) return message.channel.send(string(locale, "EXEMPT_ALREADY_ERROR", {}, "error"));

		qServerDB.config.cooldown_exempt.push(user.id);
		await dbModify("Server", {id: message.guild.id}, qServerDB);
		message.channel.send(`${string(locale, "EXEMPT_SUCCESS", { user: user.tag, id: user.id }, "success")}`, { disableMentions: "all" });

		if (qServerDB.config.channels.log) {
			let logEmbed = new Discord.MessageEmbed()
				.setAuthor(string(guildLocale, "EXEMPT_LOG_TITLE", { staff: message.author.tag, user: user.tag }), message.author.displayAvatarURL({format: "png", dynamic: true}))
				.setDescription(string(guildLocale, "BLOCK_USER_DATA", { tag: user.tag, id: user.id, mention: `<@${user.id}>` }))
				.setFooter(string(guildLocale, "STAFF_MEMBER_LOG_FOOTER", { id: message.author.id }))
				.setTimestamp()
				.setColor(client.colors.green);
			serverLog(logEmbed, qServerDB, client);
		}
	}
};
