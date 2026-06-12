declare module "path-to-regexp" {
    /**
     * Encode a string into another string.
     */
    export type Encode = (value: string) => string;

    /**
     * Decode a string into another string.
     */
    export type Decode = (value: string) => string;

    export interface ParseOptions {
        /**
         * A function for encoding input strings.
         */
        encodePath?: Encode;
    }

    /**
     * Plain text.
     */
    export interface Text {
        type: "text";
        value: string;
    }

    /**
     * A parameter designed to match arbitrary text within a segment.
     */
    export interface Parameter {
        type: "param";
        name: string;
    }

    /**
     * A wildcard parameter designed to match multiple segments.
     */
    export interface Wildcard {
        type: "wildcard";
        name: string;
    }

    /**
     * A set of possible tokens to expand when matching.
     */
    export interface Group {
        type: "group";
        tokens: Token[];
    }

    /**
     * A sequence of path match characters.
     */
    export type Token = Text | Parameter | Wildcard | Group;

    /**
     * Tokenized path instance.
     */
    export class TokenData {
        readonly tokens: Token[]
        readonly originalPath?: string
        constructor(tokens: Token[], originalPath?: string)
    }

    /**
     * Supported path types.
     */
    export type Path = string | TokenData;


    export interface PathToRegexpOptions {
        /**
         * Matches the path completely without trailing characters. (default: `true`)
         */
        end?: boolean;
        /**
         * Allows optional trailing delimiter to match. (default: `true`)
         */
        trailing?: boolean;
        /**
         * Match will be case sensitive. (default: `false`)
         */
        sensitive?: boolean;
        /**
         * The default delimiter for segments. (default: `'/'`)
         */
        delimiter?: string;
    }

    export interface MatchOptions extends PathToRegexpOptions {
        /**
         * Function for decoding strings for params, or `false` to disable entirely. (default: `decodeURIComponent`)
         */
        decode?: Decode | false;
    }
    export type ParamData = Partial<Record<string, string | string[]>>;

    export interface MatchResult<P extends ParamData> {
        path: string;
        params: P;
    }


    /**
     * A match is either `false` (no match) or a match result.
     */
    export type Match<P extends ParamData> = false | MatchResult<P>;


    export function match<P extends ParamData = any>(pattern: string, options?: MatchOptions): (testString: string) => Match<P>
}

declare module "path-to-regexp/cases.spec" {
    import type { TokenData, ParseOptions, Path, MatchOptions, Match } from "path-to-regexp"
    export interface ParserTestSet {
        path: string;
        options?: ParseOptions;
        expected: TokenData;
    }

    export interface MatchTestSet {
        path: Path | Path[];
        options?: MatchOptions & ParseOptions;
        tests: Array<{
            input: string;
            expected: Match<any>;
        }>;
    }

    export const PARSER_TESTS: ParserTestSet[]
    export const MATCH_TESTS: MatchTestSet[]
}