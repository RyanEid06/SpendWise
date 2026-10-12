import { buildVerifiedTrendFacts } from '../../src/features/statistics/verifiedFacts';
import { asObject, type SupportedLanguage, sanitizeStatistics } from './requests';

type Statistics = NonNullable<ReturnType<typeof sanitizeStatistics>>;

/** Gemini selects IDs only; all displayed financial claims are deterministic. */
export function trendFacts(stats: Statistics, currency: string, language: SupportedLanguage) {
  const facts=buildVerifiedTrendFacts(stats,currency,language);
  const {observations,categories}=facts;
  const schema={type:'object',additionalProperties:false,required:['observationIds','categoryIds'],properties:{
    observationIds:{type:'array',items:{type:'string'}},categoryIds:{type:'array',items:{type:'string'}},
  }};
  const select=(ids:unknown,catalog:{id:string;text:string}[])=>{
    if(!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length) return null;
    const selected=ids.map(id=>catalog.find(f=>f.id===id));
    return selected.some(f=>!f) ? null : selected.map(f=>f!.text);
  };
  return {schema,catalog:{observations,categories},validate(value:unknown){
    const obj=asObject(value);
    if(!obj||Object.keys(obj).length!==2) return null;
    const keyObservations=select(obj.observationIds,observations),categoryHighlights=select(obj.categoryIds,categories);
    if(!keyObservations||!categoryHighlights||keyObservations.length+categoryHighlights.length>3) return null;
    return {summary:facts.summary,keyObservations,categoryHighlights,
      recommendation:Array.isArray(obj.categoryIds)&&obj.categoryIds.includes('driver-increase') ? facts.recommendation : ''};
  }};
}
