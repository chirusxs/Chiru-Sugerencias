const { dbModifyId, dbQuery } = require("../../utils/db");
const { string } = require("../../utils/strings");
module.exports = {
	controls: {
		name: "listaservidores",
		permission: 1,
		aliases: ["al"],
		usage: "listaservidores [agregar/quitar] [id de servidor]",
		description: "Agrega un servidor a la lista de servidores permitidos",
		examples: "`{{p}}listaservidores agregar 681490407862829073`\nAgrega el servidor 681490407862829073 a la lista\n\n`{{p}}listaservidores quitar 787075858895863888`\nQuita el servidor 787075858895863888 de la lista",
		enabled: true,
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "USE_EXTERNAL_EMOJIS"]
	},
	do: async (locale, message, client, args) => {
		switch (args[0]) {
		case "agregar":
		case "+": {
			if (!args[1]) return message.channel.send(string(locale, "INVALID_GUILD_ID_ERROR", {}, "error"));
			let qServerDB = await dbQuery("Server", {id: args[1]});
			qServerDB.allowlist = true;
			await dbModifyId("Server", qServerDB.id, qServerDB);
			return message.channel.send(string(locale, "GUILD_ALLOWLIST_ADD_SUCCESS", { guild: qServerDB.id }, "success"));
		}
		case "quitar":
		case "-": {
			if (!args[1]) return message.channel.send(string(locale, "INVALID_GUILD_ID_ERROR", {}, "error"));
			let qServerDB = await dbQuery("Server", {id: args[1]});
			qServerDB.allowlist = false;
			await dbModifyId("Server", qServerDB.id, qServerDB);
			return message.channel.send(string(locale, "GUILD_ALLOWLIST_REMOVE_SUCCESS", { guild: qServerDB.id }, "success"));
		}
		default:
			return message.channel.send(string(locale, "ADD_REMOVE_INVALID_ACTION_ERROR", {}, "error"));
		}
	}
};
