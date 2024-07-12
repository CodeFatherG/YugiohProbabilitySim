import yaml from 'js-yaml';
import { Deck, buildDeck } from './deck.js';
import { AndCondition, BaseCondition, Condition, OrCondition } from './condition.js';
import { parseCondition } from './parser.js';
import { convertYdkToYaml } from './ydk-to-yaml.js';
import { CardDetails } from './card.js';

export interface SimulationInput {
    deck: Deck;
    conditions: BaseCondition[];
}

export class YamlManager {
    private _yaml: string | null = null;
    private _input: SimulationInput | null = null;
    private static instance: YamlManager;

    private constructor() {}

    public static getInstance(): YamlManager {
        if (!YamlManager.instance) {
            YamlManager.instance = new YamlManager();
        }
        return YamlManager.instance;
    }

    public loadFromYamlString(yamlString: string): SimulationInput {
        try {
            const input = yaml.load(yamlString) as { deck: Record<string, CardDetails>, conditions: string[] };

            if (!input || typeof input !== 'object') {
                throw new Error('Invalid YAML structure: not an object');
            }

            if (!input.deck || typeof input.deck !== 'object' || Array.isArray(input.deck)) {
                throw new Error('Invalid YAML structure: deck must be an object');
            }

            if (!Array.isArray(input.conditions)) {
                throw new Error('Invalid YAML structure: conditions must be an array');
            }

            // Validate deck structure
            for (const [cardName, cardDetails] of Object.entries(input.deck)) {
                if (typeof cardDetails !== 'object' || Array.isArray(cardDetails)) {
                    throw new Error(`Invalid card details for ${cardName}`);
                }
                if (typeof cardDetails.qty !== 'number' || !Array.isArray(cardDetails.tags)) {
                    throw new Error(`Invalid card structure for ${cardName}`);
                }
            }

            const deck = buildDeck(input.deck);
            const conditions = input.conditions.map(parseCondition);

            return { deck, conditions };
        } catch (error) {
            throw new Error(`Failed to parse YAML: ${(error as Error).message}`);
        }
    }

    async loadFromYamlFile(file: File): Promise<SimulationInput> {
        const yamlContent = await this.readFileContent(file);
        return this.loadFromYamlString(yamlContent);
    }

    async convertYdkToYaml(file: File): Promise<string> {
        const ydkContent = await this.readFileContent(file);
        return convertYdkToYaml(ydkContent);
    }

    private readFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event: ProgressEvent<FileReader>) => resolve(event.target?.result as string);
            reader.onerror = (error: ProgressEvent<FileReader>) => reject(error);
            reader.readAsText(file);
        });
    }

    public serializeDeckToYaml(deck: Deck): string {
        const deckObject: Record<string, CardDetails> = {};
        deck.deckList.forEach(card => {
            if (card.name !== 'Empty Card') {
                if (deckObject[card.name]) {
                    deckObject[card.name].qty = (deckObject[card.name].qty || 1) + 1;
                } else {
                    deckObject[card.name] = {
                        qty: 1,
                        tags: card.tags || [],
                        free: card.details.free
                    };
                }
            }
        });
        return yaml.dump({ deck: deckObject });
    }

    public serializeConditionsToYaml(conditions: BaseCondition[]): string {
        const conditionStrings = conditions.map(condition => this.conditionToString(condition));
        return yaml.dump({ conditions: conditionStrings });
    }

    private conditionToString(condition: BaseCondition): string {
        if (condition instanceof Condition) {
            let quantityText = "";
            if (condition.quantity > 1 || condition.operator !== '=') {
                quantityText = condition.operator === '>=' ? `${condition.quantity}+ ` : `${condition.quantity} `;
            }
            return `${quantityText}${condition.cardName}`;
        } else if (condition instanceof AndCondition) {
            return `(${condition.conditions.map(c => this.conditionToString(c)).join(' AND ')})`;
        } else if (condition instanceof OrCondition) {
            return `(${condition.conditions.map(c => this.conditionToString(c)).join(' OR ')})`;
        }
        throw new Error('Unknown condition type');
    }

    public serializeSimulationInputToYaml(input: SimulationInput): string {
        const deckYaml = this.serializeDeckToYaml(input.deck);
        const conditionsYaml = this.serializeConditionsToYaml(input.conditions);
        return deckYaml + '\n' + conditionsYaml;
    }

    get yaml(): string | null {
        return this._yaml;
    }

    get input(): SimulationInput | null {
        return this._input;
    }
}