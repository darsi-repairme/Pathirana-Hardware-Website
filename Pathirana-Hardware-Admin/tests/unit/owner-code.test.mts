// Unit tests for the Owner verification code input format (XXXX-XXXX-XXXX-XXXX).
// Run: node --test tests/unit/owner-code.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatOwnerCode, ownerCodeChars, reformatOwnerCode } from "../../src/lib/ownerCode.ts";

test("typing: upper case, a hyphen after every 4 characters, never a trailing hyphen", () => {
  assert.equal(formatOwnerCode("a"), "A");
  assert.equal(formatOwnerCode("abcd"), "ABCD");
  assert.equal(formatOwnerCode("abcde"), "ABCD-E");
  assert.equal(formatOwnerCode("abcd-efgh-jkmn-pqrs"), "ABCD-EFGH-JKMN-PQRS");
});

test("pasting: spaces, hyphens and other symbols are dropped; at most 16 characters", () => {
  assert.equal(formatOwnerCode("  abcd efgh\tjkmn_pqrs "), "ABCD-EFGH-JKMN-PQRS");
  assert.equal(formatOwnerCode("ABCD-EFGH-JKMN-PQRS-TVWX"), "ABCD-EFGH-JKMN-PQRS");
  assert.equal(ownerCodeChars("ABCD-EFGH-JKMN-PQRS").length, 16); // hyphens do not count
});

test("letters the API maps (O, I, L) are kept for the API to normalise; nothing is silently changed", () => {
  assert.equal(formatOwnerCode("0OIL"), "0OIL");
});

test("backspace and mid-code edits keep the caret on the same character", () => {
  // Deleting the last character of a group removes the hyphen with it.
  assert.deepEqual(reformatOwnerCode("ABCD-", 5), { value: "ABCD", caret: 4 });
  // Typing a character in the middle: caret right after it, not at the end.
  assert.deepEqual(reformatOwnerCode("ABXCD-EFGH", 3), { value: "ABXC-DEFG-H", caret: 3 });
  // Deleting a hyphen does not delete a letter (the hyphen comes back).
  assert.deepEqual(reformatOwnerCode("ABCDEFGH", 4), { value: "ABCD-EFGH", caret: 4 });
  // Typing at the end of a full group moves past the new hyphen.
  assert.deepEqual(reformatOwnerCode("ABCDE", 5), { value: "ABCD-E", caret: 6 });
});
