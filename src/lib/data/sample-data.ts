import { RubricConfig } from '../scoring/rubric-engine';

export const SAMPLE_SOLAR_QP = {
  id: 'd0000000-0000-0000-0000-000000000001',
  qp_code: 'ELE/Q5901',
  qp_name: 'Solar PV Installation Technician',
  nsqf_level: 4,
  version: '1.0',
  provenance: 'synthetic_demo' as const,
  nos_list: [
    {
      id: 'n0000000-0000-0000-0000-000000000001',
      nos_code: 'ELE/N5901',
      nos_name: 'Site Survey and Planning',
      weightage: 30,
      pass_threshold_percent: 70,
      criteria: [
        {
          id: 'p0000000-0000-0000-0000-000000000001',
          pc_code: 'PC1.1',
          pc_description: 'Assess site radiation, shadow analysis, and roof load capacity',
          max_score: 30,
          is_critical_safety: false
        },
        {
          id: 'p0000000-0000-0000-0000-000000000002',
          pc_code: 'PC1.2',
          pc_description: 'Inspect electrical distribution panel and determine conduit routing',
          max_score: 20,
          is_critical_safety: false
        }
      ]
    },
    {
      id: 'n0000000-0000-0000-0000-000000000002',
      nos_code: 'ELE/N5902',
      nos_name: 'Panel Mounting and Electrical Cabling',
      weightage: 40,
      pass_threshold_percent: 70,
      criteria: [
        {
          id: 'p0000000-0000-0000-0000-000000000003',
          pc_code: 'PC2.1',
          pc_description: 'Assemble modular aluminum mounting racks with specified torque specs',
          max_score: 25,
          is_critical_safety: false
        },
        {
          id: 'p0000000-0000-0000-0000-000000000004',
          pc_code: 'PC2.2',
          pc_description: 'Connect DC string wiring with MC4 crimps and polarity verification',
          max_score: 25,
          is_critical_safety: true // CRITICAL SAFETY VETO
        }
      ]
    },
    {
      id: 'n0000000-0000-0000-0000-000000000003',
      nos_code: 'ELE/N5903',
      nos_name: 'Testing, Commissioning and Grid Sync',
      weightage: 30,
      pass_threshold_percent: 70,
      criteria: [
        {
          id: 'p0000000-0000-0000-0000-000000000005',
          pc_code: 'PC3.1',
          pc_description: 'Perform open-circuit voltage (Voc) and short-circuit current (Isc) checks',
          max_score: 25,
          is_critical_safety: true // CRITICAL SAFETY VETO
        },
        {
          id: 'p0000000-0000-0000-0000-000000000006',
          pc_code: 'PC3.2',
          pc_description: 'Energize grid inverter, test earth fault indicator, and log readings',
          max_score: 25,
          is_critical_safety: false
        }
      ]
    }
  ]
};

export const SAMPLE_RUBRIC: RubricConfig = {
  rubric_id: 'rub-ele-5901-v1',
  version: '1.0',
  level_multipliers: [0.0, 0.33, 0.67, 1.0],
  descriptors: {
    0: 'Unsatisfactory / Not Demonstrated (Critical safety hazard or total failure)',
    1: 'Developing / Basic (Requires significant assistance; inconsistent execution)',
    2: 'Competent / Independent (Meets industry safety and workmanship standards)',
    3: 'Exemplary / Mastery (Exceeds standard with optimal speed, safety, and precision)'
  }
};

export const SAMPLE_ASSESSMENT = {
  id: 'a1000000-0000-0000-0000-000000000001',
  worker_id: 'w1000000-0000-0000-0000-000000000001',
  worker_name: 'Rajesh Kumar',
  worker_phone: '+91 98765 43210',
  trade_category: 'Electrical & Solar',
  years_experience: 5,
  qp_id: SAMPLE_SOLAR_QP.id,
  qp_code: SAMPLE_SOLAR_QP.qp_code,
  qp_name: SAMPLE_SOLAR_QP.qp_name,
  nsqf_level: SAMPLE_SOLAR_QP.nsqf_level,
  status: 'assigned',
  version: 1,
  assessor_name: 'Anil Verma (Govt Certified Assessor #ASR-4912)',
  reviewer_name: 'Sunita Rao (Lead SSC Reviewer #REV-0182)'
};
