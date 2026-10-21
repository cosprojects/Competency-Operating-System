import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  competencyProgress,
  computeTrackBridgePath,
  evaluateCompetencyNodeState,
  professionProgress,
  resolveCaseBand,
  type EvaluatedNodeState,
} from "../src/methodology/v1/design-graph-engine.ts";

describe("Design Competency Graph Engine (v2.0)", () => {
  it("resolves CaseBand from Self-Anchor L0-L3 correctly", () => {
    assert.equal(resolveCaseBand("L0"), "ENTRY");
    assert.equal(resolveCaseBand("L1"), "ENTRY");
    assert.equal(resolveCaseBand("L2"), "PRACTICE");
    assert.equal(resolveCaseBand("L3"), "PRACTICE");
  });

  it("does NOT drop micro-case result when caseRubricScore is passed without caseDifficultyLevel", () => {
    const result = evaluateCompetencyNodeState({
      nodeId: "node_ux_flows",
      selfReportedLevel: "L2",
      hasConfirmedArtifact: false,
      caseRubricScore: 0.75,
      // caseDifficultyLevel intentionally omitted — must infer L2 from L2->PRACTICE band
      targetLevelForTrack: "L2",
    });

    assert.equal(result.verificationStatus, "CASE_TESTED");
    assert.equal(result.confidencePercent, 72);
    assert.equal(result.verifiedLevel, "L2");
    assert.equal(result.calibrationDelta, 0);
  });

  it("elevates verifiedLevel by +1 when user excels (>= 0.85) in micro-case and marks VERIFIED with artifact", () => {
    const result = evaluateCompetencyNodeState({
      nodeId: "node_design_systems",
      selfReportedLevel: "L1",
      hasConfirmedArtifact: true,
      caseRubricScore: 1.0,
      caseDifficultyLevel: "L1",
      targetLevelForTrack: "L2",
    });

    assert.equal(result.verificationStatus, "VERIFIED");
    assert.equal(result.confidencePercent, 88);
    assert.equal(result.verifiedLevel, "L2");
    assert.equal(result.calibrationDelta, 1);
    assert.equal(result.targetGap, 0);
  });

  it("computes highest-priority bridge nodes for Graphic -> UX/UI transition", () => {
    const userStates: Record<string, EvaluatedNodeState> = {
      node_form_comp: {
        nodeId: "node_form_comp",
        selfReportedLevel: "L2",
        verifiedLevel: "L2",
        confidencePercent: 88,
        verificationStatus: "VERIFIED",
        calibrationDelta: 0,
        targetGap: 0,
      },
      node_design_systems: {
        nodeId: "node_design_systems",
        selfReportedLevel: "L0",
        verifiedLevel: "L0",
        confidencePercent: 28,
        verificationStatus: "SELF_REPORTED",
        calibrationDelta: 0,
        targetGap: 2,
      },
    };

    const bridges = computeTrackBridgePath({
      userStates,
      targetTrackRequirements: [
        { nodeId: "node_form_comp", targetLevel: "L2", isCore: false },
        { nodeId: "node_design_systems", targetLevel: "L2", isCore: true },
      ],
      edges: [
        {
          fromNodeId: "node_form_comp",
          toNodeId: "node_design_systems",
          relationType: "PIVOT_BRIDGE",
          transferWeight: 0.75,
          rationale: "Мост из графики в UI-токены",
        },
      ],
    });

    assert.equal(bridges.length, 1);
    assert.equal(bridges[0]?.nodeId, "node_design_systems");
    assert.equal(bridges[0]?.leveragedFromNodeId, "node_form_comp");
  });

  it("fills a competency only up to the profession target and ignores a missing verification", () => {
    assert.equal(competencyProgress({ verifiedLevel: "L1", targetLevel: "L2" }), 0.5);
    assert.equal(competencyProgress({ verifiedLevel: "L3", targetLevel: "L2" }), 1);
    assert.equal(competencyProgress({ verifiedLevel: "L0", targetLevel: "L0" }), 1);
    assert.equal(competencyProgress({ verifiedLevel: null, targetLevel: "L2" }), 0);
  });

  it("weights profession progress by core requirements and keeps unverified nodes in the denominator", () => {
    const progress = professionProgress({
      requirements: [
        { nodeId: "node_form_comp", targetLevel: "L2", isCore: true },
        { nodeId: "node_design_systems", targetLevel: "L2", isCore: false },
      ],
      verifiedByNodeId: { node_form_comp: "L2" },
    });

    assert.equal(progress.nodes[0]?.weight, 1.5);
    assert.equal(progress.nodes[1]?.weight, 0.5);
    assert.equal(progress.nodes[1]?.progress, 0);
    assert.equal(progress.ratio, 1.5 / 2);
  });
});
