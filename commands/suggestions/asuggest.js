const { string } = require("../../utils/strings");
module.exports = {
	controls: {
		name: "asuggest",
		permission: 10,
		usage: "asuggest",
		aliases: ["anonsuggest", "anonsuggestions"],
		description: "Placeholder command for the `asuggest` slash command",
		enabled: true,
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "EMBED_LINKS"],
		cooldown: 5,
		hidden: true,
		docs: "topics/anonymous-suggestions"
	},
	do: async (locale, message, client) => {
		return message.channel.send(`${string(locale, "ANON_SUGGEST_SLASH_NOTICE")}`);
	}
};
