# Local Test Users

These accounts are only for local development with `npm start`. They are not production or Render accounts.

Open the local user selector at:

`http://localhost:4004/dev/login`

| User ID | Password | Access | Organization |
| --- | --- | --- | --- |
| `pilot` | `pilot` | Pilot application | FinFly Demo Operator |
| `auditor` | `auditor` | Auditor application | FinFly Demo Operator |
| `admin` | `admin` | Admin, auditor, and pilot applications | FinFly Demo Operator |
| `staff` | `staff` | Internal Staff application | FinFly |
| `otherpilot` | `otherpilot` | Pilot application | Other Test Operator |

To change users, return to `/dev/login` and select another account.

Production users use database-backed authentication. Their passwords are not stored in this file or in the repository.
