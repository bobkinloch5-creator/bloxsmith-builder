// Run with: node src/lib/build-json.test.ts  (Node >= 22.6 strips TS types).
// Verifies extractBuildJson, especially salvage of TRUNCATED model output that
// previously made big builds come back empty/thin.
import { extractBuildJson, salvageTruncatedJson } from "./build-json.ts";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}`);
  }
}

// 1. Clean, well-formed build parses normally.
{
  const r = extractBuildJson(
    JSON.stringify({ message: "ok", files: [], actions: [{ type: "create", name: "A" }] }),
  );
  check("clean json parses", !!r && r.actions!.length === 1 && r.message === "ok");
}

// 2. Fenced JSON with leading prose still parses.
{
  const r = extractBuildJson('Sure!\n```json\n{"message":"hi","actions":[{"type":"x"}]}\n```');
  check("fenced json parses", !!r && (r.actions as any[]).length === 1);
}

// 3. Trailing commas are tolerated.
{
  const r = extractBuildJson('{"message":"m","actions":[{"type":"a"},],}');
  check("trailing commas parse", !!r && (r.actions as any[]).length === 1);
}

// 4. TRUNCATED mid-action: the model produced 2 complete actions then got cut
//    off in the middle of the 3rd. We must recover the 2 complete ones.
{
  const truncated =
    '{"message":"Queued a city","files":[],"actions":[' +
    '{"type":"create","className":"Folder","name":"Map","parent":"Workspace"},' +
    '{"type":"create_part","name":"Road","parent":"Workspace/Map","size":[40,1,40]},' +
    '{"type":"create_part","name":"Building","parent":"Workspace/Map","si'; // cut off here
  const r = extractBuildJson(truncated);
  check("truncated build salvages complete actions", !!r && (r.actions as any[]).length === 2);
  check(
    "salvaged actions are the complete ones",
    !!r &&
      (r.actions as any[])[0].name === "Map" &&
      (r.actions as any[])[1].name === "Road",
  );
  check("salvaged build keeps the message", !!r && r!.message === "Queued a city");
}

// 5. Truncated with a trailing comma after the last complete action.
{
  const truncated =
    '{"actions":[{"type":"a","v":1},{"type":"b","v":2},'; // comma then nothing
  const r = salvageTruncatedJson(truncated);
  check("truncated-with-trailing-comma salvages 2", !!r && (r.actions as any[]).length === 2);
}

// 6. Truncated inside a string that itself contains braces/brackets (Luau source
//    with `}` and `]`) must not confuse the bracket scanner.
{
  const truncated =
    '{"files":[{"path":"S/A","content":"for i=1,3 do print({a=1}) end"},' +
    '{"path":"S/B","content":"local t = {1,2,3} -- never closed';
  const r = extractBuildJson(truncated);
  check("string braces dont confuse salvage", !!r && (r.files as any[]).length === 1);
  check("salvaged file is the complete one", !!r && (r.files as any[])[0].path === "S/A");
}

// 7. Garbage with no object returns null (don't fabricate a build).
{
  check("no-object returns null", extractBuildJson("totally not json") === null);
  check("empty returns null", extractBuildJson("") === null);
}

if (failures) {
  // Throwing makes `node` exit non-zero without needing Node global types here.
  throw new Error(`${failures} build-json check(s) failed`);
}
console.log("\nAll build-json checks passed");
