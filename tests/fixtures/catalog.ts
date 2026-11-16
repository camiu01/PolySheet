/** @file Original MIT catalog/repository regression inputs, without third-party game text. */
import { demo } from '../../src/demo';
import { base } from './capabilities';
export const catalogSystem = {
  ...demo, id: 'catalog-original', name: 'Sentieri cataloghi',
  character_stats: [...demo.character_stats,
    { ...base('classes', 'array', [], 'resource'), resource_type: 'class_details' },
    { ...base('race', 'resource', null), resource_type: 'race' },
    { ...base('background', 'resource', null), resource_type: 'background' },
    base('subrace_id', 'string', null)],
  resources: [...demo.resources,
    { id: 'feat', name: 'Tratto', stats: [base('name', 'string', ''), base('amount', 'integer', 1)] },
    { id: 'class', name: 'Classe', stats: [base('name', 'string', ''),
      { ...base('features', 'array', [], 'resource'), resource_type: 'feat' }] },
    { id: 'class_details', name: 'Dettagli classe', stats: [
      { ...base('class', 'resource', null), resource_type: 'class' }, base('class_level', 'integer', 1)] },
    { id: 'background', name: 'Background', stats: [base('name', 'string', ''),
      { ...base('features', 'array', [], 'resource'), resource_type: 'feat' }] },
    { id: 'race', name: 'Origine', stats: [base('name', 'string', ''),
      { ...base('subraces', 'array', [], 'resource'), resource_type: 'race' }] }]
};
export const classOriginal = '\ufeff' + JSON.stringify({ system: 'catalog-original', resource_id: 'class', stats: {
  id: 'original-class', name: { value: 'Viandante' }, features: { value: [{
    resource_id: 'feat', stats: { id: 'original-feature', name: { value: 'Passo' }, amount: { value: 2 } }
  }] }
} }, null, 2);
export const raceOriginal = JSON.stringify({ resource_id: 'race', stats: { id: 'original-race', name: { value: 'Collina' } } });
export const backgroundOriginal = '\ufeff' + JSON.stringify({ resource_id: 'background', stats: {
  id: 'original-background', name: { value: 'Cartografo' }, features: { value: [{
    resource_id: 'feat', stats: { id: 'map-feature', name: { value: 'Orientamento' }, amount: { value: 3 } }
  }] }
} });
export const subraceOriginal = JSON.stringify({ resource_id: 'race', stats: {
  id: 'parent-race', name: { value: 'Valle' }, subraces: { value: [{
    resource_id: 'race', stats: { id: 'upstream-subrace', name: { value: 'Riva' } }
  }] }
} });
