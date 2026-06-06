import type { Supplier } from './types'

export const SUPPLIERS: Supplier[] = [
  {
    id: 'hk-1',
    name: 'Citybase Digital Solutions',
    city: 'Hong Kong',
    country: 'HK',
    scope: 'Smart building IoT integration, MBIS monitoring systems',
    stop: 'hk-integrator',
  },
  {
    id: 'sz-1',
    name: 'JLCPCB / EasyEDA',
    city: 'Shenzhen',
    country: 'CN',
    scope: 'PCB manufacturing, SMT assembly, sensor modules',
    website: 'https://jlcpcb.com',
    stop: 'sz-ems',
  },
  {
    id: 'sz-2',
    name: 'NextPCB',
    city: 'Shenzhen',
    country: 'CN',
    scope: 'PCB prototyping and low-volume EMS',
    website: 'https://nextpcb.com',
    stop: 'sz-ems',
  },
  {
    id: 'dg-1',
    name: 'Dongguan Yiyuan Plastic',
    city: 'Dongguan',
    country: 'CN',
    scope: 'IP67 weatherproof enclosures, ABS/PC injection moulding',
    stop: 'dg-enclosure',
  },
  {
    id: 'dg-2',
    name: 'Dongguan Sunco Metal',
    city: 'Dongguan',
    country: 'CN',
    scope: 'Metal fabrication, mounting brackets, stainless fasteners',
    stop: 'dg-enclosure',
  },
  {
    id: 'hk-comp-1',
    name: 'TÜV Rheinland Greater China',
    city: 'Hong Kong',
    country: 'HK',
    scope: 'CE/FCC/HKCA certification, RF compliance testing',
    stop: 'hk-compliance',
  },
]
