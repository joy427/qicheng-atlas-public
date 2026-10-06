import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const publicRoot = fileURLToPath(new URL("../", import.meta.url));
const atlasRoot = fileURLToPath(new URL("../../qicheng-atlas/", import.meta.url));
const companySource = JSON.parse(await readFile(`${atlasRoot}data/a-share-directory.json`, "utf8"));
const ownershipSource = JSON.parse(await readFile(`${atlasRoot}data/equity/tushare-top10-20260630.json`, "utf8"));

const companies = companySource.companies.map((item) => [item.stockCode, item.securityName, item.companyFullName, item.exchange, item.board, item.industry, item.region, item.listingDate, item.status]);
const importedEdges = ownershipSource.edges;
const edges = importedEdges.map((item) => [item.stockCode, item.targetName, item.holderName, item.holderType, item.ownershipPercent, item.sourceAsOf]);

await mkdir(`${publicRoot}data`, { recursive: true });
const writeChunks = async (prefix, rows, size = 500) => {
  const names = [];
  for (let index = 0; index < rows.length; index += size) {
    const name = `${prefix}-${String(index / size).padStart(3, "0")}.json`;
    names.push(name);
    await writeFile(`${publicRoot}data/${name}`, JSON.stringify(rows.slice(index, index + size)), "utf8");
  }
  return names;
};
const companyChunks = await writeChunks("companies", companies);
const ownershipChunks = await writeChunks("ownership", edges, 1000);
const ownershipIndex = {};
for (let index = 0; index < edges.length; index += 1) {
  const stockCode = edges[index][0];
  const chunkIndex = Math.floor(index / 1000);
  if (!ownershipIndex[stockCode]) ownershipIndex[stockCode] = [];
  if (ownershipIndex[stockCode].at(-1) !== chunkIndex) ownershipIndex[stockCode].push(chunkIndex);
}
await writeFile(`${publicRoot}data/manifest.json`, JSON.stringify({
  generatedAt: new Date().toISOString(), period: ownershipSource.meta?.period || "20260630",
  companyCount: companies.length, edgeCount: edges.length,
  companiesWithData: new Set(edges.map((item) => item[0])).size,
  companyChunks, ownershipChunks, ownershipIndex,
}), "utf8");

console.log(`Generated ${companies.length} companies and ${edges.length} ownership edges in ${publicRoot}data`);

