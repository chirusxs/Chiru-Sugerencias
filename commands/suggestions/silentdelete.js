const { fetchUser, reviewEmbed, logEmbed } = require("../../utils/misc.js");
const { serverLog } = require("../../utils/logs");
const { dbModify } = require("../../utils/db");
const { suggestionDeleteCommandCheck, checkReview } = require("../../utils/checks");
const { string } = require("../../utils/strings");
const { deleteFeedMessage } = require("../../utils/actions");
const { cleanCommand } = require("../../utils/actions");
const { actCard } = require("../../utils/trello");
module.exports = {
	controls: {
		name: "seliminar",
		permission: 3,
		usage: "seliminar [id de sugerencia] (razón)",
		description: "Elimina una sugerencia silenciosamente sin avisarle al/a la autor(a)",
		enabled: true,
		examples: "`{{p}}seliminar 35`\nElimina silenciosamente la sugerencia #35\n\n`{{p}}seliminar 35 Sugerencia ignorada`\nElimina silenciosamente con una razón",
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "EMBED_LINKS", "USE_EXTERNAL_EMOJIS"],
		cooldown: 5,
		cooldownMessage: "¿Necesitas eliminar múltiples sugerencias? ¡Usa el comando `meliminar`!",
		docs: "staff/silentdelete"
	},
	do: async (locale, message, client, args, Discord) => {
		let [returned, qServerDB, qSuggestionDB, id] = await suggestionDeleteCommandCheck(locale, message, args);
		if (returned) return message.channel.send(returned).then(sent => returned instanceof Discord.MessageEmbed ? null : cleanCommand(message, sent, qServerDB));
		let guildLocale = qServerDB.config.locale;

		if (qSuggestionDB.reviewMessage && (qSuggestionDB.channels.staff || qServerDB.config.channels.staff)) {
			let reviewCheck = checkReview(locale, message.guild, qServerDB, qSuggestionDB);
			if (reviewCheck) return message.channel.send(reviewCheck);
		}

		let suggester = await fetchUser(qSuggestionDB.suggester, client);
		if (!suggester) return message.channel.send(string(locale, "ERROR", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));

		qSuggestionDB.status = "denied";
		qSuggestionDB.staff_member = message.author.id;

		let reason;
		if (args.slice(1).join(" ").trim()) {
			reason = args.splice(1).join(" ");
			if (reason.length > 1024) return message.channel.send(string(locale, "DELETION_REASON_TOO_LONG_ERROR", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
			qSuggestionDB.denial_reason = reason;
		}

		let deleteMsg = await deleteFeedMessage(locale, qSuggestionDB, qServerDB, client);
		if (deleteMsg[0]) return message.channel.send(deleteMsg[0]).then(sent => cleanCommand(message, sent, qServerDB));

		await dbModify("Suggestion", { suggestionId: id, id: message.guild.id }, qSuggestionDB);

		let replyEmbed = new Discord.MessageEmbed()
			.setTitle(string(locale, "SUGGESTION_DELETED_TITLE"))
			.setAuthor(string(locale, "SUGGESTION_FROM_TITLE", { user: suggester.tag }), suggester.displayAvatarURL({format: "png", dynamic: true}))
			.setFooter(string(locale, "DELETED_BY", { user: message.author.tag }), message.author.displayAvatarURL({format: "png", dynamic: true}))
			.setDescription(qSuggestionDB.suggestion || string(locale, "NO_SUGGESTION_CONTENT"))
			.setColor(client.colors.red);
		reason ? replyEmbed.addField(string(locale, "REASON_GIVEN"), reason) : "";
		if (qSuggestionDB.attachment) {
			replyEmbed.addField(string(locale, "WITH_ATTACHMENT_HEADER"), qSuggestionDB.attachment)
				.setImage(qSuggestionDB.attachment);
		}
		message.channel.send(replyEmbed).then(sent => cleanCommand(message, sent, qServerDB));

		if (qSuggestionDB.reviewMessage && (qSuggestionDB.channels.staff || qServerDB.config.channels.staff)) {
			let re = reviewEmbed(locale, qSuggestionDB, suggester, "red", string(locale, "DELETED_BY", { user: message.author.tag }));
			reason ? re.addField(string(locale, "REASON_GIVEN"), reason) : "";
			client.channels.cache.get(qSuggestionDB.channels.staff || qServerDB.config.channels.staff).messages.fetch(qSuggestionDB.reviewMessage).then(fetched => fetched.edit(re)).catch(() => {});
		}

		if (qServerDB.config.channels.log) {
			let logs = logEmbed(guildLocale, qSuggestionDB, message.author, "DELETED_LOG", "red")
				.setDescription(qSuggestionDB.suggestion || string(guildLocale, "NO_SUGGESTION_CONTENT"));

			reason ? logs.addField(string(guildLocale, "REASON_GIVEN"), reason) : "";
			if (qSuggestionDB.attachment) {
				logs.setImage(qSuggestionDB.attachment);
				logs.addField(string(guildLocale, "WITH_ATTACHMENT_HEADER"), qSuggestionDB.attachment);
			}
			serverLog(logs, qServerDB, client);
		}

		await actCard("delete", qServerDB, qSuggestionDB, suggester, `${string(guildLocale, "DELETED_BY", { user: message.author.tag })}${qSuggestionDB.denial_reason ? `\n${string(guildLocale, "BLOCK_REASON_HEADER")} ${qSuggestionDB.denial_reason}` : ""}`);
	}
};
