import type { SapServer, Company } from '@/types/document'

export const SAP_SERVER: SapServer = {
  dbType: 'MSSQL_2019',
  serverName: 'pxcserver',
}

export const COMPANIES: Company[] = [
  {
    id: 'SBODemoAU',
    companyName: 'OEC Computers Australia',
    databaseName: 'SBODemoAU',
    localization: 'Australia/New Zealand',
    version: '1000261',
  },
  {
    id: 'OUTLETSLIVE',
    companyName: 'OUTLET',
    databaseName: 'OUTLETSLIVE',
    localization: 'Australia/New Zealand',
    version: '1000261',
  },
  {
    id: 'PXC-LIVE_MY_2025',
    companyName: 'Pixel Pinnacle Technology Sdn. Bhd.',
    databaseName: 'PXC-LIVE_MY_2025',
    localization: 'Australia/New Zealand',
    version: '1000261',
  },
  {
    id: 'PXC-LIVE_PH_2025',
    companyName: 'Pixelcare Consulting Corporation',
    databaseName: 'PXC-LIVE_PH_2025',
    localization: 'Australia/New Zealand',
    version: '1000261',
  },
  {
    id: 'PXC-LIVE_SG_2025',
    companyName: 'Pixelcare Consulting Pte Ltd',
    databaseName: 'PXC-LIVE_SG_2025',
    localization: 'Australia/New Zealand',
    version: '1000261',
  },
  {
    id: 'SASME_LIVEDB',
    companyName: 'SAS M&E PTE LTD',
    databaseName: 'SASME_LIVEDB',
    localization: 'Australia/New Zealand',
    version: '1000261',
  },
  {
    id: 'E-INVOICING_TEK_LIVE',
    companyName: 'TEK AUTOMOTIVE MALAYSIA SDN BHD',
    databaseName: 'E-INVOICING_TEK_LIVE',
    localization: 'Australia/New Zealand',
    version: '1000261',
  },
]
