// Industry profiles. Sutra's engine is the same for every industry;
// only these labels and the seeded materials/recipes change.

export type Industry = {
  key: string;
  name: string;
  nameHi: string;
  machine: string; // what limits capacity
  machineHi: string;
  emoji: string;
};

export const INDUSTRIES: Record<string, Industry> = {
  handloom: { key: "handloom", name: "Handloom", nameHi: "हथकरघा", machine: "loom", machineHi: "करघा", emoji: "🧵" },
  brass: { key: "brass", name: "Brass & Metal", nameHi: "पीतल", machine: "worker", machineHi: "कारीगर", emoji: "🪔" },
  toys: { key: "toys", name: "Wooden Toys", nameHi: "लकड़ी के खिलौने", machine: "lathe", machineHi: "खराद", emoji: "🪀" },
  pottery: { key: "pottery", name: "Pottery", nameHi: "मिट्टी के बर्तन", machine: "kiln", machineHi: "भट्ठी", emoji: "🏺" },
  food: { key: "food", name: "Food Processing", nameHi: "खाद्य प्रसंस्करण", machine: "line", machineHi: "लाइन", emoji: "🫙" },
  machining: { key: "machining", name: "Machine Shop", nameHi: "मशीन शॉप", machine: "machine", machineHi: "मशीन", emoji: "⚙️" },
};

export const industryOf = (key: string) => INDUSTRIES[key] ?? INDUSTRIES.handloom;
