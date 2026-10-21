import type {
  ProfileKind,
  ProfileScope,
  TaxonomyBranch,
  TaxonomyFile,
  TaxonomyGroup,
  TaxonomyLeaf,
} from "./types.ts";

export interface TaxonomyTarget {
  branchId: string;
  groupId?: string;
  leafId?: string;
  kind: ProfileKind;
  scope: ProfileScope;
}

export interface TaxonomyIndex {
  branches: Map<string, TaxonomyBranch>;
  groups: Map<string, TaxonomyGroup>;
  leaves: Map<string, TaxonomyLeaf>;
  targets: Map<string, TaxonomyTarget>;
  branchesInOrder: TaxonomyBranch[];
  groupsInOrder: TaxonomyGroup[];
  leavesInOrder: TaxonomyLeaf[];
}

const KINDS: ReadonlySet<string> = new Set(["skill", "knowledge", "tool"]);
const SCOPES: ReadonlySet<string> = new Set(["profession", "universal"]);

export function leafScope(leaf: TaxonomyLeaf): ProfileScope {
  return leaf.scope ?? "profession";
}

export function indexTaxonomy(taxonomy: TaxonomyFile): TaxonomyIndex {
  const branches = new Map<string, TaxonomyBranch>();
  const groups = new Map<string, TaxonomyGroup>();
  const leaves = new Map<string, TaxonomyLeaf>();
  const targets = new Map<string, TaxonomyTarget>();
  const branchesInOrder: TaxonomyBranch[] = [];
  const groupsInOrder: TaxonomyGroup[] = [];
  const leavesInOrder: TaxonomyLeaf[] = [];

  for (const branch of taxonomy.branches) {
    branches.set(branch.id, branch);
    branchesInOrder.push(branch);
    targets.set(branch.id, { branchId: branch.id, kind: "knowledge", scope: "profession" });
    for (const group of branch.groups) {
      groups.set(group.id, group);
      groupsInOrder.push(group);
      targets.set(group.id, { branchId: branch.id, groupId: group.id, kind: group.kind, scope: "profession" });
      for (const leaf of group.leaves) {
        leaves.set(leaf.id, leaf);
        leavesInOrder.push(leaf);
        targets.set(leaf.id, {
          branchId: branch.id,
          groupId: group.id,
          leafId: leaf.id,
          kind: leaf.kind,
          scope: leafScope(leaf),
        });
      }
    }
  }

  return { branches, groups, leaves, targets, branchesInOrder, groupsInOrder, leavesInOrder };
}

/** Пустой список — таксономия корректна. */
export function validateTaxonomy(taxonomy: TaxonomyFile): string[] {
  const errors: string[] = [];
  if (!taxonomy.taxonomyVersion) errors.push("taxonomyVersion не задан");
  if (!taxonomy.professionId) errors.push("professionId не задан");
  if (taxonomy.branches.length === 0) errors.push("нет ни одной ветки");

  const ids = new Set<string>();
  const remember = (id: string, where: string): void => {
    if (!id) errors.push(`${where}: пустой id`);
    if (ids.has(id)) errors.push(`${where}: повтор id «${id}»`);
    ids.add(id);
  };

  for (const branch of taxonomy.branches) {
    remember(branch.id, "ветка");
    if (branch.groups.length === 0) errors.push(`${branch.id}: нет групп`);
    for (const group of branch.groups) {
      remember(group.id, `ветка ${branch.id}`);
      if (!KINDS.has(group.kind)) errors.push(`${group.id}: недопустимый kind «${group.kind}»`);
      if (group.leaves.length === 0) errors.push(`${group.id}: нет листьев`);
      for (const leaf of group.leaves) {
        remember(leaf.id, `группа ${group.id}`);
        if (!KINDS.has(leaf.kind)) errors.push(`${leaf.id}: недопустимый kind «${leaf.kind}»`);
        if (leaf.scope !== undefined && !SCOPES.has(leaf.scope)) {
          errors.push(`${leaf.id}: недопустимый scope «${leaf.scope}»`);
        }
        if (!leaf.id.startsWith(`${group.id}.`)) {
          errors.push(`${leaf.id}: id листа должен начинаться с «${group.id}.»`);
        }
      }
    }
  }

  return errors;
}
