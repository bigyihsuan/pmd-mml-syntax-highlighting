import * as vscode from "vscode";

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function() {
	const tokenTypesLegend = [ "variable" ];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend: string[] = [];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDocumentSemanticTokensProvider(
			{ language: "pmdmml" },
			new DocumentSemanticTokensProvider(), legend
		)
	);
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const allTokens = this._parseText(document.getText());
		const builder = new vscode.SemanticTokensBuilder();

		allTokens.forEach((token) => {
			builder.push(
				token.line,
				token.startCharacter,
				token.length,
				this._encodeTokenType(token.tokenType),
				this._encodeTokenModifiers(token.tokenModifiers
				)
			);
		});
		return builder.build();
	}

	private _parseText(text: string): IParsedToken[] {
		const r: IParsedToken[] = [];
		const lines = text.split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			let currentOffset = 0;

			if (line.startsWith("#", currentOffset)) {
				// directives start # at the beginning of a line, and end with a newline
				const [directive, contents] = line.split(/\s+/);
				let openOffset = currentOffset;
				let closeOffset = openOffset + directive.length;
				// #directive
				r.push({
					line: i,
					startCharacter: openOffset,
					length: closeOffset - openOffset,
					tokenType: "keyword",
					tokenModifiers: []
				});
				currentOffset = this._skipWhitespace(line, closeOffset);
				// directive contents
				openOffset = currentOffset + 1;
				closeOffset = openOffset + contents.length;
				r.push({
					line: i,
					startCharacter: openOffset,
					length: closeOffset - openOffset,
					tokenType: "string",
					tokenModifiers: []
				});
				currentOffset = closeOffset;
			}
		}
		return r;
	}
	private _skipWhitespace(text: string, startingIndex: number): number {
		// in the text, skip whitespace characters until hit the end of the text or a non-whitespace
		let index = startingIndex;
		while (index < text.length && /\s/.test(text.charAt(index))) {
			index++;
		}
		return index;
	}

	private _encodeTokenType(tokenType: string): number {
		if (tokenTypes.has(tokenType)) {
			return tokenTypes.get(tokenType)!;
		} else if (tokenType === "notInLegend") {
			return tokenTypes.size + 2;
		}
		return 0;
	}

	private _encodeTokenModifiers(strTokenModifiers: string[]): number {
		let result = 0;
		for (let i = 0; i < strTokenModifiers.length; i++) {
			const tokenModifier = strTokenModifiers[i];
			if (tokenModifiers.has(tokenModifier)) {
				result = result | (1 << tokenModifiers.get(tokenModifier)!);
			} else if (tokenModifier === "notInLegend") {
				result = result | (1 << tokenModifiers.size + 2);
			}
		}
		return result;
	}
}