const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { search, SafeSearchType, SearchTimeType } = require("duck-duck-scrape");

const web_search = tool(
  async ({ query, num_of_results = 3 }) => {
    try {
      const res = await search(query, {
        safeSearch: SafeSearchType.OFF,
        locale: "us-en",
        time: SearchTimeType.DAY, // timelimit="d"
      });

      const results = (res.results || []).slice(0, num_of_results);

      if (!results.length) {
        return `No results found for query: ${query}`;
      }

      const formatted_result = [`Search results for '${query}':\n`];

      results.forEach((result, i) => {
        const title = result.title || "No title";
        const body = result.description || "No description";
        const href = result.url || "No URL";

        formatted_result.push(`${i + 1}. **${title}**\n${body}\n${href}\n`);
      });

      return formatted_result.join("\n");
    } catch (e) {
      return `Search error: ${e.message}`;
    }
  },
  {
    name: "web_search",
    description:
      "Search DuckDuckGo. Returns formatted search results with title, description and URL.",
    schema: z.object({
      query: z.string().describe("Search query string."),
      num_of_results: z
        .number()
        .optional()
        .describe("Number of results to return (default=3)."),
    }),
  }
);

module.exports = web_search;

// Test
// async function main() {
//   const result = await web_search.invoke({ query: " rec ltd ka nse code kya " });
//   console.log(result);
// }

// if (require.main === module) main();