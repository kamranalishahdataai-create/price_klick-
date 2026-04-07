// forecast.js
// MVP for mAb Demand Forecasting with WHO ICD-10 mapping
// Run: node forecast.js "lung cancer"

import axios from "axios";
import ExcelJS from "exceljs";

const condition = process.argv[2] || "lung cancer";

// Example dosing assumptions
const AVG_WEIGHT_KG = 70;
const DOSE_MG_PER_KG = 8;      // example: 8 mg/kg
const DOSE_INTERVAL_WEEKS = 2; // every 2 weeks
const TREATMENT_DURATION_MONTHS = 6;

// -------------------------------------------
// STEP 0. Map conditions to WHO indicator codes
// -------------------------------------------
// WHO GHO Indicators: https://ghoapi.azureedge.net/api/INDICATOR
const WHO_MAP = {
  "lung cancer": "WHOSIS_000004",   // placeholder – confirm real code
  "breast cancer": "WHOSIS_000005", // placeholder – confirm real code
  "rheumatoid arthritis": "MBD_0000001", // hypothetical example
};

// -------------------------------------------
// STEP 1. Get trials from ClinicalTrials.gov
// -------------------------------------------
async function getClinicalTrials(condition) {
  const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(condition)}&filter.phase=Phase%202&filter.phase=Phase%203`;
  const res = await axios.get(url);
  return res.data.studies || [];
}

function isMab(interventions) {
  return interventions.some(
    (intv) =>
      intv.interventionType === "BIOLOGICAL" &&
      String(intv.interventionName || "").toLowerCase().includes("mab")
  );
}

// -------------------------------------------
// STEP 2. Calculate per-patient annual demand
// -------------------------------------------
function calculateAnnualKgPerPatient() {
  const dosesPerYear = (52 / DOSE_INTERVAL_WEEKS) * (TREATMENT_DURATION_MONTHS / 12);
  const mg = AVG_WEIGHT_KG * DOSE_MG_PER_KG * dosesPerYear; // mg
  return (mg / 1_000_000).toFixed(2); // mg → kg
}

// -------------------------------------------
// STEP 3. Get WHO incidence/prevalence
// -------------------------------------------
async function getWHOIncidence(condition) {
  const indicator = WHO_MAP[condition.toLowerCase()];
  if (!indicator) {
    console.warn(`⚠ No WHO mapping for: ${condition}. Using fallback of 50k patients.`);
    return 50000;
  }

  try {
    const url = `https://ghoapi.azureedge.net/api/${indicator}?$filter=SpatialDim eq 'WORLD' and TimeDim eq 2024`;
    const res = await axios.get(url);
    if (res.data.value && res.data.value.length > 0) {
      return Math.round(res.data.value[0].Value); // patient pool for 2024
    }
    console.warn(`⚠ WHO returned no data for ${condition}, using fallback.`);
    return 50000;
  } catch (err) {
    console.error("WHO API error:", err.message);
    return 50000; // fallback
  }
}

// -------------------------------------------
// STEP 4. Main pipeline
// -------------------------------------------
async function main() {
  console.log(`Fetching trials for condition: ${condition}...`);
  const trials = await getClinicalTrials(condition);

  console.log(`Fetching WHO incidence data for: ${condition}...`);
  const patientPool = await getWHOIncidence(condition);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Forecast");

  sheet.addRow([
    "NCT ID", "Title", "Phase", "Intervention Name", "Is mAb?",
    "Annual kg/patient", "Patient Pool", "Total kg demand"
  ]);

  for (const trial of trials) {
    const id = trial.protocolSection?.identificationModule?.nctId || "N/A";
    const title = trial.protocolSection?.identificationModule?.officialTitle || "N/A";
    const phase = trial.protocolSection?.designModule?.phases?.join(",") || "N/A";
    const interventions = trial.protocolSection?.interventionsModule?.interventions || [];

    const mab = isMab(interventions);
    const interventionName = interventions.map(i => i.interventionName).join("; ");

    const perPatientKg = mab ? calculateAnnualKgPerPatient() : "N/A";
    const totalKg = mab ? (Number(patientPool) * Number(perPatientKg)).toFixed(0) : "N/A";

    sheet.addRow([
      id,
      title,
      phase,
      interventionName,
      mab ? "Yes" : "No",
      perPatientKg,
      mab ? patientPool : "N/A",
      totalKg
    ]);
  }

  await workbook.xlsx.writeFile("mAbForecast_WHO.xlsx");
  console.log("✅ Forecast Excel written: mAbForecast_WHO.xlsx");
}

main().catch(console.error);
