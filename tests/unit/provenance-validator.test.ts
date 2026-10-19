import { describe, it, expect } from 'vitest';
import { validateQualificationPack } from '../../src/lib/security/provenance-validator';

describe('Qualification Pack Provenance and Schema Validator', () => {
  const validSyntheticPack = {
    qp_code: 'ELE/Q5901',
    qp_name: 'Solar PV Installation Technician',
    nsqf_level: 4,
    version: '1.0',
    provenance: 'synthetic_demo',
    nos_list: [
      {
        nos_code: 'ELE/N5901',
        nos_name: 'Site Assessment',
        nos_type: 'core',
        weightage: 50,
        pass_threshold_percent: 70,
        criteria: [
          {
            pc_code: 'PC1.1',
            pc_description: 'Assess site radiation and structural feasibility',
            max_score: 30,
            is_critical_safety: false
          }
        ]
      },
      {
        nos_code: 'ELE/N5902',
        nos_name: 'Installation & Earthing',
        nos_type: 'core',
        weightage: 50,
        pass_threshold_percent: 70,
        criteria: [
          {
            pc_code: 'PC2.1',
            pc_description: 'Connect grounding and safety disconnects properly',
            max_score: 30,
            is_critical_safety: true
          }
        ]
      }
    ]
  };

  it('accepts valid synthetic demonstration qualification pack with 100% total weight', () => {
    const res = validateQualificationPack(validSyntheticPack);
    expect(res.success).toBe(true);
    expect(res.data?.provenance).toBe('synthetic_demo');
  });

  it('rejects official_gazetted provenance if gazette number or official source URL is missing', () => {
    const officialWithoutGazette = {
      ...validSyntheticPack,
      provenance: 'official_gazetted'
    };
    const res = validateQualificationPack(officialWithoutGazette);
    expect(res.success).toBe(false);
    expect(res.errors?.some(e => e.includes('gazette_notification_number'))).toBe(true);
  });

  it('accepts official_gazetted pack when gazette number and valid URL are provided', () => {
    const validOfficial = {
      ...validSyntheticPack,
      provenance: 'official_gazetted',
      gazette_notification_number: 'ND/2023/NSQF-5901',
      official_source_url: 'https://nsqf.gov.in/qualifications/ele-q5901.pdf'
    };
    const res = validateQualificationPack(validOfficial);
    expect(res.success).toBe(true);
  });

  it('rejects packs where sum of NOS weights is not 100%', () => {
    const invalidWeights = {
      ...validSyntheticPack,
      nos_list: [
        {
          ...validSyntheticPack.nos_list[0],
          weightage: 60
        },
        {
          ...validSyntheticPack.nos_list[1],
          weightage: 30
        }
      ]
    };
    const res = validateQualificationPack(invalidWeights);
    expect(res.success).toBe(false);
    expect(res.errors?.some(e => e.includes('Sum of all NOS weightages must equal exactly 100%'))).toBe(true);
  });
});
