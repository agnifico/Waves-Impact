/**
 * Summon definition — the template for a summon entity.
 * The engine looks this up when a 'summon' behavior fires.
 */
export interface SummonDef {
	id: string;
	name: string;
	attackDamage: number;
	attackCooldownMs: number;
	moveCooldownMs: number;
	/** If true, damage mirrors the owner's last-landed BA damage. */
	mirrorsOwnerBA?: boolean;
}
