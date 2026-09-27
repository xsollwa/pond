/** Versioned semantic definitions, not classifier keywords. */
export const TAXONOMY_VERSION = "2.0.0" as const;
export const TAXONOMY_NODES = [
  {
    id: "economic_security",
    label: "Economic security",
    parentId: null,
    definition: "Civic issues concerning economic security.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "Grocery parcels run out before payday",
      "The kitchen is closed on Sundays",
    ],
  },
  {
    id: "civil_rights",
    label: "Civil rights",
    parentId: null,
    definition: "Civic issues concerning civil rights.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "The same qualifications, different answers",
      "Different treatment at the public counter",
    ],
  },
  {
    id: "housing",
    label: "Housing",
    parentId: null,
    definition: "Civic issues concerning housing.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "Working full time and still priced out",
      "A place in the town where they work",
    ],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    parentId: null,
    definition: "Civic issues concerning healthcare.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "The nearest appointment is now hours away",
      "Patients wait months for essential treatment",
    ],
  },
  {
    id: "education",
    label: "Education",
    parentId: null,
    definition: "Civic issues concerning education.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "Families cannot find a preschool place",
      "A second chance to learn",
    ],
  },
  {
    id: "environment",
    label: "Environment",
    parentId: null,
    definition: "Civic issues concerning environment.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "A local plan to cut emissions",
      "Preparing neighborhoods for hotter summers",
    ],
  },
  {
    id: "transportation",
    label: "Transportation",
    parentId: null,
    definition: "Civic issues concerning transportation.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: ["The last bus may disappear", "Longer gaps between trains"],
  },
  {
    id: "labor",
    label: "Labor",
    parentId: null,
    definition: "Civic issues concerning labor.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "Workers ask to negotiate together",
      "A seat at the negotiating table",
    ],
  },
  {
    id: "immigration",
    label: "Immigration",
    parentId: null,
    definition: "Civic issues concerning immigration.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "People seeking refuge need help with their claims",
      "Arriving safely is only the beginning",
    ],
  },
  {
    id: "democracy",
    label: "Democracy",
    parentId: null,
    definition: "Civic issues concerning democracy.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "Voting hours exclude people on long shifts",
      "Registration has an unnecessary barrier",
    ],
  },
  {
    id: "justice_public_safety",
    label: "Justice and public safety",
    parentId: null,
    definition: "Civic issues concerning justice and public safety.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "Complaints need an independent hearing",
      "Returning home without a route to support",
    ],
  },
  {
    id: "reproductive_rights",
    label: "Reproductive rights",
    parentId: null,
    definition: "Civic issues concerning reproductive rights.",
    exclusions:
      "Use supported child labels when specific evidence exists. Never infer a subtype from a broad topic alone.",
    examples: [
      "Care is available only across a state border",
      "A restriction would close the remaining service",
    ],
  },
  {
    id: "economic_security.food_insecurity",
    label: "Food insecurity",
    parentId: "economic_security",
    definition: "Unreliable access to sufficient affordable food.",
    exclusions:
      "Nutrition advice or health consequences without a food-access problem.",
    examples: [
      "The neighborhood pantry has reduced each family's grocery parcel because demand has doubled. Parents skip dinner so their children can eat. A nutrition leaflet mentions diabetes, but the request is for donated staples and reliable access to food, not clinical treatment.",
    ],
  },
  {
    id: "economic_security.poverty",
    label: "Poverty",
    parentId: "economic_security",
    definition:
      "Material deprivation, income support and inability to meet basic needs.",
    exclusions: "Voluntary frugality without deprivation or a public issue.",
    examples: [
      "An increase of a few dollars in monthly income ended a family's cash assistance. Their remaining earnings cannot cover essentials. Residents want the eligibility rules reviewed so taking a little extra work does not deepen material hardship.",
    ],
  },
  {
    id: "economic_security.unemployment",
    label: "Unemployment",
    parentId: "economic_security",
    definition:
      "Loss of work, barriers to employment and employment assistance.",
    exclusions: "Working conditions when loss of work is not central.",
    examples: [
      "The only large factory in the area is closing, eliminating hundreds of jobs. Residents have asked for retraining and help finding work before unemployment benefits run out. The immediate concern is securing replacement employment, not negotiating conditions at the closed plant.",
    ],
  },
  {
    id: "economic_security.wages",
    label: "Wages",
    parentId: "economic_security",
    definition: "Pay adequacy, wage floors, wage theft and compensation.",
    exclusions: "Working conditions unrelated to pay.",
    examples: [
      "Restaurant staff say their employer regularly deletes the last hour of each shift from their recorded time. They want the labor agency to recover wages already earned. No union negotiation is described; the issue is missing pay and enforcement of payment rules.",
    ],
  },
  {
    id: "economic_security.cost_of_living",
    label: "Cost of living",
    parentId: "economic_security",
    definition: "Affordability of essential everyday goods and services.",
    exclusions: "Housing-only costs or medical coverage alone.",
    examples: [
      "Electricity, heating fuel and groceries have all become more expensive, while household incomes have barely changed. Residents are seeking a public review of charges and targeted help with essential bills. The article does not focus on housing or medical treatment.",
    ],
  },
  {
    id: "civil_rights.racial_discrimination",
    label: "Racial discrimination",
    parentId: "civil_rights",
    definition:
      "Unequal treatment or structural exclusion based on race or ethnicity.",
    exclusions:
      "Demographic differences alone without evidenced discriminatory treatment or structural exclusion.",
    examples: [
      "An audit submitted identical job applications with names associated with different racial groups. Black applicants received far fewer interview invitations. Residents are calling for equal-treatment enforcement; the report is about discriminatory selection rather than a general shortage of jobs.",
    ],
  },
  {
    id: "civil_rights.gender_discrimination",
    label: "Gender discrimination",
    parentId: "civil_rights",
    definition: "Unequal treatment or exclusion based on gender or sex.",
    exclusions:
      "Outcome differences without evidence of discriminatory practices.",
    examples: [
      "Women applying to a public apprenticeship program say staff told them the placements were for men. They met the published requirements. The complaint asks the program to end gender-based exclusion and assess applicants on the same terms.",
    ],
  },
  {
    id: "civil_rights.disability_rights",
    label: "Disability rights",
    parentId: "civil_rights",
    definition:
      "Equal access, accommodation, autonomy and disability nondiscrimination.",
    exclusions: "Treating a disability without a rights or access issue.",
    examples: [
      "Residents using wheelchairs cannot enter the venue selected for a public hearing. The organizer declined to move the meeting or provide an accessible alternative. The complaint seeks equal participation for disabled residents, not treatment of their disabilities.",
    ],
  },
  {
    id: "civil_rights.lgbtq_rights",
    label: "LGBTQ rights",
    parentId: "civil_rights",
    definition:
      "Equal treatment regarding sexual orientation or gender identity.",
    exclusions:
      "Identity mentioned without a public rights or exclusion issue.",
    examples: [
      "A publicly funded family service accepts different-sex couples but turns away same-sex couples with the same circumstances. Residents have filed an equality complaint. They want the service offered on equal terms rather than a separate program.",
    ],
  },
  {
    id: "civil_rights.religious_discrimination",
    label: "Religious discrimination",
    parentId: "civil_rights",
    definition:
      "Unequal treatment or unreasonable burdens tied to religious belief or observance.",
    exclusions: "Theology and religious customs without discrimination.",
    examples: [
      "Workers say requests to observe one religious holiday are routinely accepted while comparable requests from another faith are refused. They seek equal consideration and reasonable accommodations. The disagreement concerns religious discrimination, not a general proposal for paid leave.",
    ],
  },
  {
    id: "housing.affordability",
    label: "Housing affordability",
    parentId: "housing",
    definition: "Ability to afford stable housing and housing assistance.",
    exclusions:
      "General prices unrelated to shelter or an isolated land-use decision.",
    examples: [
      "Rents have risen much faster than local incomes, leaving families unable to find homes they can afford. Residents want rental assistance and additional affordable housing. The article discusses shelter costs rather than a particular eviction procedure or land-use rule.",
    ],
  },
  {
    id: "housing.homelessness",
    label: "Homelessness",
    parentId: "housing",
    definition: "Lack of stable shelter and public responses to homelessness.",
    exclusions:
      "Rent increases without homelessness or shelter-policy evidence.",
    examples: [
      "The emergency shelter turns people away each night because every bed is occupied. People sleeping outside ask for more safe places to stay. Officials are considering an expanded shelter service and longer-term support for residents who have no stable home.",
    ],
  },
  {
    id: "housing.zoning",
    label: "Zoning and land use",
    parentId: "housing",
    definition:
      "Land-use rules and planning decisions affecting homes and development.",
    exclusions: "Housing costs without a land-use decision.",
    examples: [
      "The planning board is considering whether zoning rules should allow apartments on parcels currently restricted to detached houses. Residents can comment on the proposed land-use change. The article does not establish a transit service change or a particular rent level.",
    ],
  },
  {
    id: "housing.tenant_rights",
    label: "Tenant rights",
    parentId: "housing",
    definition:
      "Tenant protections, eviction procedures, habitability and landlord obligations.",
    exclusions:
      "Home purchase advice or unrelated landlord business decisions.",
    examples: [
      "Tenants say their landlord ordered them to leave immediately without the notice or hearing required by law. A tenants' group is asking for enforcement of eviction protections. The article centers on legal treatment of renters, not whether a new building may be constructed.",
    ],
  },
  {
    id: "healthcare.access",
    label: "Healthcare access",
    parentId: "healthcare",
    definition:
      "Availability, affordability and quality of medical treatment and services.",
    exclusions:
      "Health consequences of hunger, discrimination or another problem without a medical-service barrier.",
    examples: [
      "A community clinic is closing, leaving residents unable to obtain routine medical care nearby. Patients are asking the health authority to maintain a local service. The article focuses on availability of treatment and does not attribute the closure to discrimination.",
    ],
  },
  {
    id: "healthcare.insurance",
    label: "Health insurance",
    parentId: "healthcare",
    definition: "Medical coverage, eligibility, premiums, benefits and claims.",
    exclusions: "Nonmedical benefits or an incidental reference to insurance.",
    examples: [
      "Patients say their health insurance plans deny claims for treatment that their policies appear to cover. They want a review of claim procedures and benefit rules. The dispute is about medical coverage, not a general inability to afford everyday goods.",
    ],
  },
  {
    id: "healthcare.public_health",
    label: "Public health",
    parentId: "healthcare",
    definition:
      "Population-level disease prevention and public health systems.",
    exclusions:
      "Passing mentions of diabetes or nutrition in a food-access story.",
    examples: [
      "A public vaccination campaign cannot reach all eligible neighborhoods because its outreach team is understaffed. Health officials are discussing how to improve disease prevention across the population. The proposal concerns public health capacity rather than compulsory treatment of an individual.",
    ],
  },
  {
    id: "healthcare.mental_health",
    label: "Mental health services",
    parentId: "healthcare",
    definition:
      "Access to mental health care, crisis support and public mental health policy.",
    exclusions:
      "Personal mood or wellness advice without a collective service or policy issue.",
    examples: [
      "Residents seeking urgent mental health support say the community crisis service cannot answer calls overnight. The county is considering funding additional staff. The proposed action is to improve access to mental health services, not to interpret an individual's private feelings.",
    ],
  },
  {
    id: "education.access",
    label: "Education access",
    parentId: "education",
    definition:
      "Ability to attend and benefit from education and learning services.",
    exclusions: "A school reference incidental to another problem.",
    examples: [
      "A district has fewer early-childhood learning places than eligible children. Families want an expansion so attendance is not limited by the available spaces. The issue is access to education rather than medical childcare advice or a private product comparison.",
    ],
  },
  {
    id: "education.funding",
    label: "Education funding",
    parentId: "education",
    definition:
      "School budgets, staffing resources and educational funding allocation.",
    exclusions: "Governance disputes with no resource allocation issue.",
    examples: [
      "The school district plans to eliminate classroom positions to close a budget gap. Families and teachers are reviewing how the education funding decision will affect students. Residents may comment before the budget is adopted.",
    ],
  },
  {
    id: "education.governance",
    label: "School governance",
    parentId: "education",
    definition:
      "Decision-making, representation, transparency and curriculum authority in education.",
    exclusions: "Study advice, homework and routine activities.",
    examples: [
      "The school board is considering a curriculum change without its usual public consultation. Families are asking for a transparent process and a chance to speak. The report focuses on educational decision-making rather than the amount of the school budget.",
    ],
  },
  {
    id: "education.student_rights",
    label: "Student rights",
    parentId: "education",
    definition:
      "Student due process, privacy, speech and fair-treatment protections.",
    exclusions: "Academic performance without a rights question.",
    examples: [
      "Students say a district disciplinary process offers no meaningful way to challenge a suspension. They are asking for notice, fair hearings and an appeal route. The public concern is students' procedural rights rather than their examination scores.",
    ],
  },
  {
    id: "environment.climate",
    label: "Climate",
    parentId: "environment",
    definition: "Emissions, mitigation, adaptation and climate policy.",
    exclusions: "Ordinary weather forecasts without a climate connection.",
    examples: [
      "The council is considering a plan to reduce greenhouse emissions from municipal buildings and transport operations. Residents can comment on the climate targets and timetable. The article concerns climate mitigation rather than a forecast for next week's weather.",
    ],
  },
  {
    id: "environment.pollution",
    label: "Pollution",
    parentId: "environment",
    definition: "Environmental contamination, regulation and remediation.",
    exclusions: "A medical diagnosis with no environmental source.",
    examples: [
      "Residents report repeated industrial emissions entering their homes and want stronger pollution controls. The regulator is considering enforcement against the plant. The public problem is environmental contamination even though the article mentions possible respiratory effects.",
    ],
  },
  {
    id: "environment.conservation",
    label: "Conservation",
    parentId: "environment",
    definition:
      "Protection of habitats, ecosystems, wildlife and natural resources.",
    exclusions:
      "Nature photography or recreation without stewardship concerns.",
    examples: [
      "A proposed development would remove a protected wetland used by local wildlife. Conservation groups are seeking a review of the environmental decision. Their concern is preserving habitat, not the cost or tenancy rules of the proposed buildings.",
    ],
  },
  {
    id: "environment.water",
    label: "Water systems and access",
    parentId: "environment",
    definition:
      "Drinking-water supply, affordability, wastewater and water management.",
    exclusions: "Water mentioned without a resource or utility issue.",
    examples: [
      "Households unable to pay their water bills have received shutoff notices. A community group wants affordable access to drinking water and a review of utility policy. The article focuses on the water system rather than food supplies or medical insurance.",
    ],
  },
  {
    id: "transportation.public_transit",
    label: "Public transit",
    parentId: "transportation",
    definition: "Public bus and rail service provision, operation and funding.",
    exclusions: "Private trips, car shopping and incidental transit mentions.",
    examples: [
      "The transit agency proposes canceling an evening bus route used by residents returning from work. Passengers want the service retained and have organized comments for the public hearing. The article concerns public transit provision rather than a private driving itinerary.",
    ],
  },
  {
    id: "transportation.street_safety",
    label: "Street safety",
    parentId: "transportation",
    definition: "Pedestrian, cycling and road-user safety and street design.",
    exclusions: "Traffic reports without a safety or design problem.",
    examples: [
      "Neighbors have documented repeated near misses where people cross a busy road. They are asking for a safer crossing and lower vehicle speeds. The request concerns pedestrian safety and street design rather than police powers or criminal sentencing.",
    ],
  },
  {
    id: "transportation.infrastructure",
    label: "Transportation infrastructure",
    parentId: "transportation",
    definition:
      "Maintenance, design and investment in roads, bridges and transport facilities.",
    exclusions: "Land-use decisions primarily about housing.",
    examples: [
      "Engineers say a public bridge requires major repairs to remain usable. The local authority is consulting residents about its infrastructure investment plan. The issue is maintenance of a transportation asset rather than rules for building housing nearby.",
    ],
  },
  {
    id: "transportation.mobility_access",
    label: "Mobility access",
    parentId: "transportation",
    definition:
      "Equitable ability to reach essential destinations through transportation.",
    exclusions: "A medical-service problem without a transportation barrier.",
    examples: [
      "Residents without cars cannot reach jobs and public services using available transportation. A community consultation is examining options for practical access. The issue is mobility and access to destinations, not a claim that the services themselves refuse to help residents.",
    ],
  },
  {
    id: "labor.collective_bargaining",
    label: "Collective bargaining",
    parentId: "labor",
    definition:
      "Unions, organizing, negotiations and collective worker representation.",
    exclusions: "Pay comparisons without collective representation.",
    examples: [
      "Employees have formed a union and are asking their employer to recognize it as their bargaining representative. They want a collective process for negotiating workplace decisions. The story is about organizing rights rather than an announced amount of a pay increase.",
    ],
  },
  {
    id: "labor.workplace_safety",
    label: "Workplace safety",
    parentId: "labor",
    definition: "Protection from workplace hazards and safety enforcement.",
    exclusions: "Illness unrelated to workplace conditions.",
    examples: [
      "Staff describe working in extreme heat without adequate breaks, water or protection. They want the safety regulator to enforce safe working conditions. The report concerns hazards at work even though heat illness is mentioned as a consequence.",
    ],
  },
  {
    id: "labor.working_conditions",
    label: "Working conditions",
    parentId: "labor",
    definition: "Scheduling, hours, security and treatment at work.",
    exclusions: "Joblessness or compensation as the sole concern.",
    examples: [
      "Workers receive shifts with almost no notice and are penalized when they cannot rearrange their lives immediately. They are seeking predictable scheduling protections. The story centers on working conditions, without a dispute about the amount of wages paid.",
    ],
  },
  {
    id: "labor.leave",
    label: "Paid and protected leave",
    parentId: "labor",
    definition:
      "Access to sick, family, parental and protected employment leave.",
    exclusions: "Medical treatment without an employment leave issue.",
    examples: [
      "Employees have asked lawmakers for protected parental leave so they do not risk dismissal when caring for a new child. The proposal concerns employment leave. It does not discuss abortion services or whether healthcare providers are available.",
    ],
  },
  {
    id: "immigration.asylum_refugees",
    label: "Asylum and refugees",
    parentId: "immigration",
    definition:
      "Protection, reception and resettlement for people seeking refuge.",
    exclusions: "Tourism and routine travel.",
    examples: [
      "A community organization cannot meet demand for advice from asylum seekers navigating protection procedures. Volunteers are seeking support for the service. The article concerns access to the asylum process rather than ordinary tourism or vacation planning.",
    ],
  },
  {
    id: "immigration.deportation",
    label: "Deportation and detention",
    parentId: "immigration",
    definition:
      "Immigration removal, detention, enforcement and related process.",
    exclusions: "Criminal incarceration without an immigration dimension.",
    examples: [
      "Residents facing deportation say they have little opportunity to present their cases before removal proceeds. Advocates want immigration procedures reviewed. The story centers on removal policy rather than an unrelated criminal prosecution.",
    ],
  },
  {
    id: "immigration.citizenship",
    label: "Citizenship",
    parentId: "immigration",
    definition: "Naturalization, nationality and citizenship procedures.",
    exclusions: "Voting administration unrelated to citizenship status.",
    examples: [
      "Applicants who have completed the requirements for naturalization cannot obtain decisions because of a processing backlog. They are asking the agency to address the delay. The report concerns access to citizenship procedures rather than the management of polling stations.",
    ],
  },
  {
    id: "immigration.protections",
    label: "Immigrant protections",
    parentId: "immigration",
    definition: "Rights and service access affected by immigration status.",
    exclusions: "Demographic mentions without a status-related barrier.",
    examples: [
      "A local policy bars undocumented residents from a general assistance service offered to other residents in the same circumstances. Community groups seek equal access regardless of status. The article identifies a status-based barrier without attributing it to race or medical eligibility.",
    ],
  },
  {
    id: "democracy.voting_access",
    label: "Voting access",
    parentId: "democracy",
    definition:
      "Ability to register, cast a ballot and participate in public elections.",
    exclusions: "Consumer polls and fictional elections.",
    examples: [
      "Residents say the limited hours at polling places make it difficult to cast a ballot after work. They are asking election officials to extend access. The concern is the ability to vote, not whether the workplace should change its schedules.",
    ],
  },
  {
    id: "democracy.election_administration",
    label: "Election administration",
    parentId: "democracy",
    definition:
      "Election operations, counting, audits and administrative procedures.",
    exclusions:
      "Partisan commentary without a substantive election-process issue.",
    examples: [
      "Election administrators are holding a public briefing on counting procedures, audits and poll-worker training. Residents can ask how the process is checked. The article concerns election administration and does not assert that particular voters were denied access.",
    ],
  },
  {
    id: "democracy.representation",
    label: "Representation",
    parentId: "democracy",
    definition: "Districts, electoral systems and political representation.",
    exclusions: "A generic mention of a politician.",
    examples: [
      "Proposed electoral district lines split a community among several constituencies. Residents say this weakens their representation and want the boundary commission to reconsider. The issue is how people are represented, not the opening hours of polling locations.",
    ],
  },
  {
    id: "democracy.accountability",
    label: "Government accountability",
    parentId: "democracy",
    definition:
      "Public oversight, transparency, public records and corruption prevention.",
    exclusions: "Private purchase reviews without public governance concerns.",
    examples: [
      "Residents have requested documents explaining how a municipal contract was awarded, but the council has not released them. They want transparency and independent oversight. The public concern is accountable government rather than the quality of a private purchase.",
    ],
  },
  {
    id: "justice_public_safety.policing",
    label: "Policing",
    parentId: "justice_public_safety",
    definition: "Police practices, powers, oversight and accountability.",
    exclusions: "Routine crime reporting without a policing question.",
    examples: [
      "Residents say complaints about police conduct are reviewed only by the same department involved. They are asking for independent oversight and transparent findings. The article focuses on policing accountability without identifying race as the basis of the conduct.",
    ],
  },
  {
    id: "justice_public_safety.incarceration",
    label: "Incarceration",
    parentId: "justice_public_safety",
    definition: "Prison or jail conditions, sentencing impacts and reentry.",
    exclusions: "Immigration detention primarily about removal policy.",
    examples: [
      "People leaving prison describe gaps in reentry support that make rebuilding everyday life difficult. A community group wants a coordinated public response. The story concerns the consequences of incarceration rather than immigration removal procedures.",
    ],
  },
  {
    id: "justice_public_safety.courts",
    label: "Courts and legal access",
    parentId: "justice_public_safety",
    definition:
      "Legal assistance, court procedures, due process and access to justice.",
    exclusions: "Legal language in fiction or trivia.",
    examples: [
      "People representing themselves in civil court say forms and procedures are impossible to understand without assistance. They seek legal aid and a fair opportunity to be heard. The article is about access to justice rather than a particular housing or immigration claim.",
    ],
  },
  {
    id: "justice_public_safety.violence_prevention",
    label: "Violence prevention",
    parentId: "justice_public_safety",
    definition: "Community measures to prevent violence and protect people.",
    exclusions: "Fictional violence or incidental crime mentions.",
    examples: [
      "A neighborhood program intervenes in disputes before they become violent, but its funding is ending. Residents want support for community violence prevention. No firearm law or change in police powers is proposed in the article.",
    ],
  },
  {
    id: "justice_public_safety.gun_policy",
    label: "Gun policy",
    parentId: "justice_public_safety",
    definition:
      "Firearm regulation, access, safety requirements and gun-policy debate.",
    exclusions: "Game weapons or historical collections without civic context.",
    examples: [
      "A legislative committee is reviewing a proposal to strengthen background checks for firearm purchases. Residents are invited to give evidence about gun policy. The issue is regulation of firearms rather than weapons in a game or a historical collection.",
    ],
  },
  {
    id: "reproductive_rights.abortion_access",
    label: "Abortion access",
    parentId: "reproductive_rights",
    definition:
      "Availability, legality and practical access to abortion services.",
    exclusions: "Medical services unrelated to abortion.",
    examples: [
      "Residents seeking abortions must travel long distances because local services are legally restricted. A support group is organizing practical assistance and advocating changes to access rules. The central issue is abortion access, not a generic insurance claim.",
    ],
  },
  {
    id: "reproductive_rights.contraception",
    label: "Contraception access",
    parentId: "reproductive_rights",
    definition:
      "Availability, affordability and rights concerning contraception.",
    exclusions: "Unrelated insurance and healthcare disputes.",
    examples: [
      "Public clinics may stop offering contraceptives under a proposed funding condition. Residents are asking officials to maintain affordable access. The concern is access to contraception, not a debate about whether unrelated medical treatments are covered by insurance.",
    ],
  },
  {
    id: "reproductive_rights.autonomy",
    label: "Reproductive autonomy",
    parentId: "reproductive_rights",
    definition:
      "Reproductive decision-making rights and freedom from coercion.",
    exclusions: "General medical care without reproductive autonomy concerns.",
    examples: [
      "Patients describe being sterilized without meaningful informed consent and are seeking protections against reproductive coercion. The public inquiry concerns bodily autonomy and reproductive decisions. It does not establish a separate insurance or clinic-capacity issue.",
    ],
  },
] as const;
export type TaxonomyId = (typeof TAXONOMY_NODES)[number]["id"];
export type TaxonomyNode = (typeof TAXONOMY_NODES)[number];
const index: ReadonlyMap<string, TaxonomyNode> = new Map(
  TAXONOMY_NODES.map((node) => [node.id, node]),
);
export function isTaxonomyId(id: string): id is TaxonomyId {
  return index.has(id);
}
export function taxon(id: TaxonomyId): TaxonomyNode {
  return index.get(id)!;
}
export function parentCategory(id: TaxonomyId): TaxonomyId {
  return taxon(id).parentId ?? id;
}
export function ancestors(id: TaxonomyId): TaxonomyId[] {
  const parent = taxon(id).parentId;
  return parent ? [parent, id] : [id];
}
export const LEAF_IDS = TAXONOMY_NODES.filter(
  (node) => node.parentId !== null,
).map((node) => node.id);
