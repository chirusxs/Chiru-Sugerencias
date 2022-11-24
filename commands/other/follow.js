const { dbQuery, dbModify, dbQueryAll } = require("../../utils/db");
const { checkSuggestion } = require("../../utils/checks");
const { pages } = require("../../utils/actions");
const { string } = require("../../utils/strings");
const { cleanCommand } = require("../../utils/actions");
module.exports = {
	controls: {
		name: "seguir",
		permission: 10,
		usage: "seguir [id de sugerencia|lista|auto] (si|no|alternar)",
		description: "Sigue sugerencias y revisa las sugerencias que sigues",
		enabled: true,
		examples: "`{{p}}seguir 35`\nSigue la sugerencia #35\n\n`{{p}}seguir lista`\nMuestra las sugerencias que sigues\n\n`{{p}}seguir auto activar`\nSigue automáticamente las sugerencias que votes positivamente\n\n`{{p}}seguir auto desactivar`\nDeja de seguir sugerencias automáticamente\n\n`{{p}}seguir auto alternar`\nAlterna si sigues sugerencias automáticamente",
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "USE_EXTERNAL_EMOJIS", "EMBED_LINKS"],
		cooldown: 5,
		dmAvailable: true,
		docs: "topics/follow"
	},
	do: async (locale, message, client, args, Discord) => {
		const qServerDB = message.guild ? await message.guild.db : null;
		let qUserDB = await dbQuery("User", { id: message.author.id });
		if (!args[0]) return message.channel.send(string(locale, "FOLLOW_NO_PARAMS_ERROR", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
		switch (args[0].toLowerCase()) {
		case "list": {
			let suggestions = await dbQueryAll("Suggestion", { suggestionId: { $in: qUserDB.subscribed.map(s => s.id) } });
			suggestions = suggestions.filter(s => qUserDB.subscribed.find(q => q.id === s.suggestionId && q.guild === s.id));
			let suggestionArr = [];
			for await (let s of suggestions) {
				try {
					let foundApi = await client.api.guilds(s.id).get();
					suggestionArr.push(`#${s.suggestionId} in **${foundApi.name}**`);
					// eslint-disable-next-line no-empty
				} catch (e) {}
			}
			if (suggestionArr.length === 0) return message.channel.send(string(locale, "NONE_FOLLOWED", {}, "error"));
			let chunks = suggestionArr.chunk(20);
			let embeds = [];
			for await (let chunk of chunks) {
				embeds.push(new Discord.MessageEmbed()
					.setDescription(chunk.join("\n"))
					.setColor(client.colors.default)
					.setTitle(string(locale, "FOLLOWING_TITLE"))
					.setAuthor(chunks.length > 1 ? string(locale, "PAGINATION_PAGE_COUNT") : "")
					.setFooter(chunks.length > 1 ? string(locale, "PAGINATION_NAVIGATION_INSTRUCTIONS") : ""));
			}

			pages(locale, message, embeds);
			return;
		}
		case "auto": {
			if (!args[1]) return message.channel.send(string(locale, qUserDB.auto_subscribe ? "AUTOFOLLOW_ENABLED" : "AUTOFOLLOW_DISABLED")).then(sent => cleanCommand(message, sent, qServerDB));
			switch (args[1].toLowerCase()) {
			case "activar":
			case "si":
			case "sí": {
				if (qUserDB.auto_subscribe) return message.channel.send(string(locale, "AUTOFOLLOW_ALREADY_ENABLED", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
				qUserDB.auto_subscribe = true;
				await dbModify("User", {id: qUserDB.id}, qUserDB);
				return message.channel.send(string(locale, "AUTOFOLLOW_ENABLED", {}, "success")).then(sent => cleanCommand(message, sent, qServerDB));
			}
			case "desactivar":
			case "no": {
				if (!qUserDB.auto_subscribe) return message.channel.send(string(locale, "AUTOFOLLOW_ALREADY_DISABLED", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
				qUserDB.auto_subscribe = false;
				await dbModify("User", {id: qUserDB.id}, qUserDB);
				return message.channel.send(string(locale, "AUTOFOLLOW_DISABLED", {}, "success")).then(sent => cleanCommand(message, sent, qServerDB));
			}
			case "alternar": {
				qUserDB.auto_subscribe = !qUserDB.auto_subscribe;
				await dbModify("User", {id: qUserDB.id}, qUserDB);
				return message.channel.send(string(locale, qUserDB.auto_subscribe ? "AUTOFOLLOW_ENABLED" : "AUTOFOLLOW_DISABLED", {}, "success")).then(sent => cleanCommand(message, sent, qServerDB));
			}
			default:
				return message.channel.send(string(locale, "ON_OFF_TOGGLE_ERROR", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
			}
		}
		default:
			if (!message.guild) return message.channel.send(string(locale, "COMMAND_SERVER_ONLY", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
			if (!args[0]) return message.channel.send(string(locale, "INVALID_SUGGESTION_ID_ERROR", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
			// eslint-disable-next-line no-case-declarations
			let [fetchSuggestion, qSuggestionDB] = await checkSuggestion(locale, message.guild, args[0]);
			if (fetchSuggestion) return message.channel.send(fetchSuggestion);
			if (qUserDB.subscribed.find(s => s.id === qSuggestionDB.suggestionId)) return message.channel.send(string(locale, "ALREADY_FOLLOWING_ERROR", { id: qSuggestionDB.suggestionId }, "error")).then(sent => cleanCommand(message, sent, qServerDB));
			qUserDB.subscribed.push({
				id: qSuggestionDB.suggestionId,
				guild: message.guild.id,
				auto: false
			});
			qUserDB.save();
			return message.channel.send(string(locale, "FOLLOW_SUCCESS", { id: qSuggestionDB.suggestionId }, "success")).then(sent => cleanCommand(message, sent, qServerDB)).then(sent => cleanCommand(message, sent, qServerDB));
		}
	}
};
