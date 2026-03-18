export interface CreatedEntity {
	type: "campaign" | "adSet" | "adCreative" | "ad" | "creative"
	ref: string
	metaId: string
	name: string
}

export class PipelineContext {
	private refs = new Map<string, string>()
	createdEntities: CreatedEntity[] = []
	adAccountId: string

	constructor(adAccountId: string) {
		this.adAccountId = adAccountId
	}

	setRef(name: string, metaId: string): void {
		this.refs.set(name, metaId)
	}

	resolveRef(name: string): string {
		const id = this.refs.get(name)
		if (!id) {
			throw new Error(`Unresolved ref: "${name}". Available refs: ${[...this.refs.keys()].join(", ")}`)
		}
		return id
	}

	hasRef(name: string): boolean {
		return this.refs.has(name)
	}

	trackCreated(entity: CreatedEntity): void {
		this.createdEntities.push(entity)
		console.log(`  ✓ Created ${entity.type} "${entity.name}" → ${entity.metaId}`)
	}
}
