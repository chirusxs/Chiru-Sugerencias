const { fetchUser } = require("../../utils/misc");
const { dbQuery, dbModifyId } = require("../../utils/db");
const { string } = require("../../utils/strings");

module.exports = {
	controls: {
		name: "vetar",
		permission: 1,
		usage: "vetar [servidor|miembro] [id] (si|no)",
		description: "Veta el uso del bot de manera global",
		enabled: true,
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "USE_EXTERNAL_EMOJIS"],
		examples: "`{{p}}vetar miembro 851072040189427722`\nRevisa si Chiruso ha sido vetado\n\n`{{p}}vetar miembro 851072040189427722 si`\nVeta a Chiruso\n\n`{{p}}vetar miembro 851072040189427722 no`\nQuita un veto aplicado a Chiruso"
	},
	do: async (locale, message, client, args) => {
		let type = args.shift();
		switch (type) {
		case "miembro": {
			if (!args[0]) return message.channel.send(string(locale, "INVALID_USER_ERROR", {}, "error"));
			let foundUser = await fetchUser(args[0], client);
			if (!foundUser || foundUser.id === "0") return message.channel.send(string(locale, "INVALID_USER_ERROR", {}, "error"));
			if (args[1] && !(args[1] === "sí" || args[1] === "no")) return message.channel.send(string(locale, "INVALID_GLOBALBAN_NEW_PARAMS_ERROR", {}, "error"));
			let qUserDB = await dbQuery("User", { id: foundUser.id });
			if (!args[1]) {
				let { blocked } = qUserDB;
				return message.channel.send(string(locale, blocked ? "IS_GLOBALLY_BANNED" : "IS_NOT_GLOBALLY_BANNED", { banned: foundUser.tag }));
			}
			if (qUserDB.flags && qUserDB.flags.includes("PROTECTED")) return message.channel.send(string(locale, "USER_PROTECTED_NEW_ERROR", {}, "error"));
			if (args[1] === "sí") {
				if (foundUser.bot) return message.channel.send(string(locale, "BLOCK_USER_BOT_ERROR", {}, "error"));
				qUserDB.blocked = true;
			}
			else if (args[1] === "no") qUserDB.blocked = false;
			await dbModifyId("User", foundUser.id, qUserDB);
			return message.channel.send(string(locale, qUserDB.blocked ? "IS_GLOBALLY_BANNED" : "IS_NOT_GLOBALLY_BANNED", { banned: foundUser.tag }, "success"));
		}
		case "servidor": {
			if (!args[0]) return message.channel.send(string(locale, "INVALID_GUILD_ID_ERROR", {}, "error"));
			let foundGuild = client.guilds.cache.get(args[0]);
			if (args[1] && !(args[1] === "sí" || args[1] === "no")) return message.channel.send(string(locale, "INVALID_GLOBALBAN_NEW_PARAMS_ERROR", {}, "error"));
			let qServerDB = await dbQuery("Server", { id: args[0] });
			if (!args[1]) {
				let { blocked } = qServerDB;
				return message.channel.send(blocked ? string(locale, "IS_GLOBALLY_BANNED", { banned: foundGuild ? foundGuild.name : args[0] }) : string(locale, "IS_NOT_GLOBALLY_BANNED", { banned: foundGuild ? foundGuild.name : args[0] }));
			}
			if (qServerDB.flags && qServerDB.flags.includes("PROTECTED")) return message.channel.send(string(locale, "GUILD_PROTECTED_NEW_ERROR", {}, "error"));
			if (args[1] === "sí") qServerDB.blocked = true;
			else if (args[1] === "no") qServerDB.blocked = false;
			await dbModifyId("Server", args[0], qServerDB);
			if (foundGuild && qServerDB.blocked) foundGuild.leave();
			return message.channel.send(qServerDB.blocked ? string(locale, "IS_GLOBALLY_BANNED", { banned: foundGuild ? foundGuild.name : args[0] }, "success") : string(locale, "IS_NOT_GLOBALLY_BANNED", { banned: foundGuild ? foundGuild.name : args[0] }, "success"));
		}
		default: {
			return message.channel.send(string(locale, "SPECIFY_USER_OR_GUILD_ERROR", {}, "error"));
		}
		}

	}
};
