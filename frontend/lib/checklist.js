// The safety checklist questions. `key` is the field name sent to the API
// (it must match the CHECKLIST keys in backend/src/routes/submissions.js).
export const CHECKLIST_GROUPS = [
  {
    title: "PPE worn",
    items: [
      { key: "ppeHardHat", label: "Hard hat" },
      { key: "ppeVest", label: "Vest" },
      { key: "ppeBoots", label: "Boots" },
      { key: "ppeEyeProtection", label: "Eye protection" },
    ],
  },
  {
    title: "Site safety",
    items: [
      { key: "fallProtectionInPlace", label: "Fall protection in place" },
      { key: "laddersInspected", label: "Ladders inspected" },
      { key: "scaffoldingInspected", label: "Scaffolding inspected" },
      { key: "toolsGoodCondition", label: "Tools in good condition" },
      { key: "cordsGoodCondition", label: "Cords in good condition" },
    ],
  },
];
