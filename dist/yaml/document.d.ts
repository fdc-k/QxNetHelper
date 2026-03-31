import type { Document, ParsedNode, YAMLMap, YAMLSeq } from 'yaml';
export type ParsedYamlDocument = Document.Parsed<ParsedNode>;
export type YamlMappingNode = YAMLMap<ParsedNode, ParsedNode | null>;
export type YamlSequenceNode = YAMLSeq<ParsedNode>;
export declare const parseSingleYamlDocument: (source: string) => ParsedYamlDocument;
export declare const getListenersSequence: (document: ParsedYamlDocument) => YamlSequenceNode;
export declare const getProxiesSequence: (document: ParsedYamlDocument) => YamlSequenceNode;
export declare const getProxyGroupsSequence: (document: ParsedYamlDocument) => YamlSequenceNode | null;
export declare const assertUniqueProxyNames: (proxies: YamlSequenceNode) => void;
export declare const findTrafficResetProxy: (proxies: YamlSequenceNode) => {
    index: number;
    item: YamlMappingNode;
};
//# sourceMappingURL=document.d.ts.map