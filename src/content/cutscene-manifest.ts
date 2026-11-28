import dawnWakeupCutsceneData from "../../content/cutscenes/dawn-wakeup.json";
import jordanPassCutsceneData from "../../content/cutscenes/jordan-pass-intro.json";
import miloBayWrapperData from "../../content/cutscenes/milo-bay-wrapper.json";
import miloLoftSketchData from "../../content/cutscenes/milo-loft-sketch.json";
import miloPassMelodyData from "../../content/cutscenes/milo-pass-melody.json";
import miloPlazaRaccoonData from "../../content/cutscenes/milo-plaza-raccoon.json";
import miloSchoolSketchData from "../../content/cutscenes/milo-school-sketch.json";
import minibossChefMateoData from "../../content/cutscenes/miniboss-chef-mateo.json";
import minibossMrBellData from "../../content/cutscenes/miniboss-mr-bell.json";
import minibossMrPipData from "../../content/cutscenes/miniboss-mr-pip.json";
import minibossMrsFlurryData from "../../content/cutscenes/miniboss-mrs-flurry.json";
import minibossMsCoralData from "../../content/cutscenes/miniboss-ms-coral.json";
import minibossMsRowanData from "../../content/cutscenes/miniboss-ms-rowan.json";
import plazaHoodCutsceneData from "../../content/cutscenes/plaza-hood-sighting.json";
import sueBayCutsceneData from "../../content/cutscenes/sue-bay-intro.json";

export const CUTSCENE_FILES: readonly [unknown, string][] = [
  [dawnWakeupCutsceneData, "dawn-wakeup"],
  [plazaHoodCutsceneData, "plaza-hood-sighting"],
  [sueBayCutsceneData, "sue-bay-intro"],
  [jordanPassCutsceneData, "jordan-pass-intro"],
  [miloSchoolSketchData, "milo-school-sketch"],
  [miloPlazaRaccoonData, "milo-plaza-raccoon"],
  [miloBayWrapperData, "milo-bay-wrapper"],
  [miloPassMelodyData, "milo-pass-melody"],
  [miloLoftSketchData, "milo-loft-sketch"],
  [minibossMrsFlurryData, "miniboss-mrs-flurry"],
  [minibossMsRowanData, "miniboss-ms-rowan"],
  [minibossMrBellData, "miniboss-mr-bell"],
  [minibossMsCoralData, "miniboss-ms-coral"],
  [minibossMrPipData, "miniboss-mr-pip"],
  [minibossChefMateoData, "miniboss-chef-mateo"],
];
