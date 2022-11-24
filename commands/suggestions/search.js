const { baseConfig } = require("../../utils/checks");
const { string } = require("../../utils/strings");
const { dbQueryAll } = require("../../utils/db");
const { pages } = require("../../utils/actions");
const timestring = require("timestring");
module.exports = {
	controls: {
		name: "buscar",
		permission: 3,
		usage: "buscar [término de búsqueda]",
		description: "Busca una sugerencia del servidor",
		enabled: true,
		examples: "`{{p}}buscar verificacion:verificada autor:851072040189427722`\nBusca sugerencias verificadas creadas por 851072040189427722\n\n`{{p}}buscar estado:\"en progreso\" staff:851072040189427722`\nBusca sugerencias \"En Progreso\" verificadas por 851072040189427722\n\n`{{p}}buscar votos>10 tiempo>\"1 month\" contenido!\"test\"`\nBusca con más de 10 votos, con antigüedad de más de un mes, y sin tener en cuenta el contenido \"test\"",
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "EMBED_LINKS", "USE_EXTERNAL_EMOJIS"],
		cooldown: 5,
		docs: "topics/search"
	},
	do: async (locale, message, client, args, Discord) => {
		let [returned, qServerDB] = await baseConfig(locale, message.guild);
		if (returned) return message.channel.send(returned);

		function escapeRegExp(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
		}

		function handleSymbol (value, voteArr) {
			switch (voteArr[0]) {
			case ">":
				return value > voteArr[1];
			case "<":
				return value < voteArr[1];
			case ":":
				return value === voteArr[1];
			case "!":
				return value !== voteArr[1];
			}
		}

		function handleQuoteInput (input) {
			input = input.toLowerCase();
			return input.match(/['"“”‘’„”«»]?([\s\S]+)['"“”‘’„”«»]/) ? input.match(/['"“”‘’„”«»]?([\s\S]+)['"“”‘’„”«»]/)[1] : input;
		}

		let qString = args.join(" ").match(/(verificacion|estado|votos|autor|staff|tiempo|contenido)(>|<|!|:)("[^"]+"|[\S]+)/g);
		if (!qString || !qString.length) return message.channel.send(string(locale, "SEARCH_BAD_QUERY_ERROR", {}, "error"));
		let m = await message.channel.send(string(locale, "SUGGESTION_LOADING"));
		let query = { id: message.guild.id };
		let voteQuery = [];
		let timeQuery = [];
		for (let q of qString) {
			q = q.match(/(verificacion|estado|votos|autor|staff|tiempo|contenido)(>|<|!|:)("[^"]+"|[\S]+)/);
			switch (q[1].toLowerCase()) {
			case "verificacion":
				// eslint-disable-next-line no-case-declarations
				let status;
				switch (handleQuoteInput(q[3])) {
				case "verificada":
					status = "approved";
					break;
				case "declinada":
					status = "denied";
					break;
				case "sin_verificar":
					status = "awaiting_review";
					break;
				}
				if (status) query["status"] = q[2] !== "!" ? status : { $ne: status };
				break;
			case "mark":
				// eslint-disable-next-line no-case-declarations
				let mark;
				switch (handleQuoteInput(q[3])) {
				case "implementada":
					mark = "implemented";
					break;
				case "en progreso":
				case "progreso":
					mark = "working";
					break;
				case "considerando":
				case "consideración":
				case "consideracion":
				case "en consideración":
				case "en consideracion":
					mark = "consideration";
					break;
				case "no":
				case "no sucedera":
				case "no sucederá":
					mark = "no";
					break;
				case "por defecto":
				case "default":
					mark = null;
				}
				query["displayStatus"] = q[2] !== "!" ? mark : { $ne: mark };
				break;
			case "votos":
				// eslint-disable-next-line no-case-declarations
				let votes = parseInt(handleQuoteInput(q[3]));
				if (votes || votes === 0) voteQuery = [q[2], votes];
				break;
			case "autor":
				query["suggester"] = q[2] !== "!" ? handleQuoteInput(q[3]) : { $ne: handleQuoteInput(q[3]) };
				break;
			case "staff":
				query["staff_member"] = q[2] !== "!" ? handleQuoteInput(q[3]) : { $ne: handleQuoteInput(q[3]) };
				break;
			case "tiempo":
				// eslint-disable-next-line no-case-declarations
				let time = (handleQuoteInput(q[3]) ? timestring(handleQuoteInput(q[3]), "ms") : null) || null;
				if (time) timeQuery = [q[2], time];
				break;
			case "contenido":
				query["suggestion"] = q[2] !== "!" ? { "$regex": escapeRegExp(handleQuoteInput(q[3])) } : { $not: { "$regex": escapeRegExp(handleQuoteInput(q[3])) } };
				break;
			}
		}
		console.log(query);
		let suggestions = await dbQueryAll("Suggestion", query);
		if (voteQuery[0]) suggestions = suggestions.filter(s => s.status === "approved" && handleSymbol(s.votes.up - s.votes.down, voteQuery));
		if (timeQuery[0]) suggestions = suggestions.filter(s => handleSymbol(Date.now()-new Date(s.submitted).getTime(), timeQuery));
		if (!suggestions.length) return message.channel.send(string(locale, "NO_SUGGESTIONS_FOUND", {}, "error"));
		let embedArray = [];
		let index = 1;
		for await (let i of suggestions) {
			let description;
			switch (i.status) {
			case "approved":
				description = i.implemented ? string(locale, "NO_LINK_SEARCH", { p: qServerDB.config.prefix, id: i.suggestionId }) : `[${string(locale, "SUGGESTION_FEED_LINK")}](https://discord.com/channels/${i.id}/${i.channels.suggestions || qServerDB.config.channels.suggestions}/${i.messageId})`;
				break;
			case "denied":
				description = string(locale, "NO_LINK_SEARCH", { p: qServerDB.config.prefix, id: i.suggestionId });
				break;
			case "awaiting_review":
				description = `[${string(locale, "QUEUE_POST_LINK")}](https://discord.com/channels/${i.id}/${i.channels.staff || qServerDB.config.channels.staff}/${i.reviewMessage})`;
				break;
			}
			embedArray.push({
				"fieldTitle": `${index}: ${string(locale, "SUGGESTION_HEADER")} #${i.suggestionId.toString()}`,
				"fieldDescription": description,
				index
			});
			index++;
		}

		let chunks = embedArray.chunk(10);
		let embeds = [];
		for await (let chunk of chunks) {
			let embed = new Discord.MessageEmbed()
				.setTitle(string(locale, "SEARCH_TITLE", { min: chunk[0].index, max: chunk[chunk.length-1].index, total: embedArray.length }))
				.setColor(client.colors.blue)
				.setAuthor(chunks.length > 1 ? string(locale, "PAGINATION_PAGE_COUNT") : "")
				.setFooter(chunks.length > 1 ? string(locale, "PAGINATION_NAVIGATION_INSTRUCTIONS") : "");
			chunk.forEach(f => embed.addField(f.fieldTitle, f.fieldDescription));
			embeds.push(embed);
		}
		message.channel.stopTyping(true);
		m.delete();
		return pages(locale, message, embeds);
	}
};
