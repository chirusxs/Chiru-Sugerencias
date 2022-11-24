const { dbQuery, dbModify } = require("../../utils/db");
const { string } = require("../../utils/strings");
const { cleanCommand } = require("../../utils/actions");
module.exports = {
	controls: {
		name: "notificaciones",
		permission: 10,
		aliases: ["notificar"],
		usage: "notificaciones (si|no|alternar)",
		description: "Revisa tus ajustes de notificaciones",
		enabled: true,
		examples: "`{{p}}notificaciones`\nMuestra tus ajustes de notificaciones\n\n`{{p}}notificaciones sí`\nActiva las notificaciones para tus sugerencias\n\n`{{p}}notificaciones no`\nDesactiva las notificaciones\n\n`{{p}}notificaciones alternar`\nAlterna las notificaciones",
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "USE_EXTERNAL_EMOJIS"],
		cooldown: 5,
		dmAvailable: true,
		docs: "sumup"
	},
	do: async (locale, message, client, args) => {
		const qServerDB = message.guild ? await message.guild.db : null;
		let qUserDB = await dbQuery("User", { id: message.author.id });
		if (!args[0]) return message.channel.send(string(locale, qUserDB.notify ? "NOTIFICATIONS_ENABLED" : "NOTIFICATIONS_DISABLED")).then(sent => cleanCommand(message, sent, qServerDB));
		switch (args[0].toLowerCase()) {
		case "activar":
		case "sí":
		case "si": {
			if (qUserDB.notify) return message.channel.send(string(locale, "NOTIFICATIONS_ALREADY_ENABLED", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
			qUserDB.notify = true;
			await dbModify("User", {id: qUserDB.id}, qUserDB);
			return message.channel.send(string(locale, "NOTIFICATIONS_ENABLED", {}, "success")).then(sent => cleanCommand(message, sent, qServerDB));
		}
		case "desactivar":
		case "no": {
			if (!qUserDB.notify) return message.channel.send(string(locale, "NOTIFICATIONS_ALREADY_DISABLED", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
			qUserDB.notify = false;
			await dbModify("User", {id: qUserDB.id}, qUserDB);
			return message.channel.send(string(locale, "NOTIFICATIONS_DISABLED", {}, "success")).then(sent => cleanCommand(message, sent, qServerDB));
		}
		case "alternar": {
			qUserDB.notify = !qUserDB.notify;
			await dbModify("User", {id: qUserDB.id}, qUserDB);
			return message.channel.send(string(locale, qUserDB.notify ? "NOTIFICATIONS_ENABLED" : "NOTIFICATIONS_DISABLED", {}, "success")).then(sent => cleanCommand(message, sent, qServerDB));
		}
		default:
			return message.channel.send(string(locale, "ON_OFF_TOGGLE_ERROR", {}, "error")).then(sent => cleanCommand(message, sent, qServerDB));
		}
	}
};
