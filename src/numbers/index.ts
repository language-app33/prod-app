/*
 * Which composer belongs to which language, and nothing else.
 *
 * The one door out of this directory. Every name here is neutral on
 * purpose: an app file that imports `composerFor` is asking the app a
 * question, and an app file that imported `arComposer` would be a screen
 * that knows about Arabic, which is the thing this codebase spends a test
 * on preventing. The composers themselves are reached through the
 * language pack, the way `spell` always was.
 *
 * Adding a language is two lines here and one file beside this one.
 */
import type { LangId } from "../types.ts";
import type { Composer, TimeComposer } from "./types.ts";
import { arComposer } from "./ar-PS.ts";
import { arTimeComposer } from "./ar-PS.time.ts";
import { heComposer } from "./he-IL.ts";
import { heTimeComposer } from "./he-IL.time.ts";
import { viComposer } from "./vi-Hue.ts";

const COMPOSERS: Record<string, Composer> = {
  "ar-PS": arComposer,
  "he-IL": heComposer,
  "vi-Hue": viComposer,
};

const TIME_COMPOSERS: Record<string, TimeComposer> = {
  "ar-PS": arTimeComposer,
  "he-IL": heTimeComposer,
};

/** How this language builds its numbers, or null where nobody has said. */
export const composerFor = (langId: LangId | null | undefined): Composer | null =>
  (langId && COMPOSERS[langId]) || null;

/** How it tells the time, which is a separate answer: a language may
    build numbers and have nobody yet who knows its clock. */
export const timeComposerFor = (langId: LangId | null | undefined): TimeComposer | null =>
  (langId && TIME_COMPOSERS[langId]) || null;

/** Every language with numbers, for a screen that has to offer a choice. */
export const composerLanguages = (): LangId[] => Object.keys(COMPOSERS);

export const timeLanguages = (): LangId[] => Object.keys(TIME_COMPOSERS);
