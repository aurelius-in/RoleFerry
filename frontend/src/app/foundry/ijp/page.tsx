"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useFoundry } from "@/context/FoundryContext";

export default function IJPPage() {
  const { setState } = useFoundry();
  const [titles, setTitles] = useState("Product Manager, Director of Product");
  const [levels, setLevels] = useState("Senior, Director");
  const [locations, setLocations] = useState("Remote, NYC");
  const [skillsMust, setSkillsMust] = useState("PLG, Activation, Analytics");

  const save = async () => {
    const body = {
      titles: titles.split(",").map((s) => s.trim()).filter(Boolean),
      levels: levels.split(",").map((s) => s.trim()).filter(Boolean),
      locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
      skills_must: skillsMust.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const res = await api<{ id: string }>("/ijps", "POST", body);
    setState({ ijp: { id: res.id, ...body } });
    alert("IJP saved");
  };

  const inputCls = "px-3 py-2 rounded bg-white/5 border border-white/10 w-full";
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Ideal Job Profile</h1>
      <div className="grid grid-cols-1 gap-3">
        <label className="space-y-1">
          <div className="text-sm opacity-80">Titles</div>
          <input className={inputCls} value={titles} onChange={(e) => setTitles(e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-sm opacity-80">Levels</div>
          <input className={inputCls} value={levels} onChange={(e) => setLevels(e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-sm opacity-80">Locations</div>
          <input className={inputCls} value={locations} onChange={(e) => setLocations(e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-sm opacity-80">Must-have skills</div>
          <input className={inputCls} value={skillsMust} onChange={(e) => setSkillsMust(e.target.value)} />
        </label>
        <div>
          <button onClick={save} className="px-4 py-2 rounded brand-gradient text-black font-medium">Save IJP</button>
        </div>
      </div>
    </main>
  );
}

