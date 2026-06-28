#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

const inputPath = resolve(process.argv[2] ?? "data/glossary.json");
const outputPath = resolve(process.argv[3] ?? "database/jiujitsu-bench.sqlite");
const schemaPath = resolve("schema.sql");

function sqlString(value) {
  if (value === undefined || value === null) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  return String(n);
}

function insert(table, row) {
  const keys = Object.keys(row);
  const values = keys.map((key) => {
    const value = row[key];
    return typeof value === "number" ? sqlNumber(value) : sqlString(value);
  });
  return `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${values.join(", ")});`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateGlossary(glossary) {
  const errors = [];

  if (!glossary.metadata || typeof glossary.metadata !== "object") {
    errors.push("metadata must be an object");
  }

  for (const key of ["terms", "aliases", "relationships", "benchmark_categories"]) {
    if (!Array.isArray(glossary[key])) {
      errors.push(`${key} must be an array`);
    }
  }

  if (errors.length) return errors;

  const termIds = new Set();
  for (const term of glossary.terms) {
    if (!term.id) errors.push("term is missing id");
    if (!term.name) errors.push(`term ${term.id ?? "(unknown)"} is missing name`);
    if (!term.type) errors.push(`term ${term.id ?? "(unknown)"} is missing type`);
    if (!term.family) errors.push(`term ${term.id ?? "(unknown)"} is missing family`);
    if (!["both", "gi", "no_gi"].includes(term.context)) {
      errors.push(`term ${term.id ?? "(unknown)"} has invalid context ${term.context}`);
    }
    if (!term.definition) errors.push(`term ${term.id ?? "(unknown)"} is missing definition`);
    if (termIds.has(term.id)) errors.push(`duplicate term id: ${term.id}`);
    termIds.add(term.id);
  }

  const categoryIds = new Set();
  for (const category of glossary.benchmark_categories) {
    if (!category.id) errors.push("benchmark category is missing id");
    if (!category.name) errors.push(`benchmark category ${category.id ?? "(unknown)"} is missing name`);
    if (categoryIds.has(category.id)) errors.push(`duplicate benchmark category id: ${category.id}`);
    categoryIds.add(category.id);
  }

  for (const alias of glossary.aliases) {
    if (!termIds.has(alias.term_id)) {
      errors.push(`alias references unknown term_id: ${alias.term_id}`);
    }
    if (!alias.alias) errors.push(`alias for ${alias.term_id ?? "(unknown)"} is missing alias`);
    if (!alias.language) errors.push(`alias ${alias.alias ?? "(unknown)"} is missing language`);
    if (!alias.type) errors.push(`alias ${alias.alias ?? "(unknown)"} is missing type`);
  }

  for (const relationship of glossary.relationships) {
    if (!termIds.has(relationship.source_id)) {
      errors.push(`relationship references unknown source_id: ${relationship.source_id}`);
    }
    if (!termIds.has(relationship.target_id)) {
      errors.push(`relationship references unknown target_id: ${relationship.target_id}`);
    }
    if (!relationship.relationship_type) {
      errors.push(`relationship ${relationship.source_id ?? "(unknown)"} -> ${relationship.target_id ?? "(unknown)"} is missing relationship_type`);
    }
  }

  return errors;
}

const glossary = readJson(inputPath);
const validationErrors = validateGlossary(glossary);
if (validationErrors.length) {
  console.error("Glossary validation failed:");
  for (const error of validationErrors) console.error(`- ${error}`);
  process.exit(1);
}

const schema = readFileSync(schemaPath, "utf8");
const statements = [schema];

for (const [key, value] of Object.entries(glossary.metadata)) {
  statements.push(insert("metadata", { key, value: typeof value === "string" ? value : JSON.stringify(value) }));
}

for (const term of glossary.terms) {
  statements.push(insert("terms", {
    id: term.id,
    name: term.name,
    type: term.type,
    family: term.family,
    context: term.context,
    definition: term.definition
  }));
}

for (const alias of glossary.aliases) {
  statements.push(insert("aliases", {
    term_id: alias.term_id,
    alias: alias.alias,
    language: alias.language,
    type: alias.type,
    notes: alias.notes ?? null
  }));
}

for (const relationship of glossary.relationships) {
  statements.push(insert("relationships", {
    source_id: relationship.source_id,
    relationship_type: relationship.relationship_type,
    target_id: relationship.target_id,
    notes: relationship.notes ?? null
  }));
}

for (const category of glossary.benchmark_categories) {
  statements.push(insert("benchmark_categories", {
    id: category.id,
    name: category.name,
    default_weight: category.default_weight
  }));
}

statements.push("PRAGMA foreign_key_check;");

mkdirSync(dirname(outputPath), { recursive: true });
rmSync(outputPath, { force: true });

execFileSync("sqlite3", [outputPath], {
  input: statements.join("\n"),
  stdio: ["pipe", "inherit", "inherit"]
});

console.log(`Wrote ${outputPath}`);
console.log(`Terms: ${glossary.terms.length}`);
console.log(`Aliases: ${glossary.aliases.length}`);
console.log(`Relationships: ${glossary.relationships.length}`);
