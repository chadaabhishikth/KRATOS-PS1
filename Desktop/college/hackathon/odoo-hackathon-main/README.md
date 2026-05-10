**🌍 Traveloop: Relational Itinerary & Budget Architect**

Traveloop is a comprehensive travel management "super-app" designed to streamline the planning process through a robust relational ecosystem.

✅ Status: Fully functional MVP connected to Neon Cloud PostgreSQL.

🚀 **The Core Innovation (Relational Database)**

Unlike simple "list-based" travel apps, Traveloop uses a **PostgreSQL** relational schema to maintain strict data hierarchy:
- **Relational Integrity:** Trips act as the parent container for multiple **Stops** (Cities).
- **Nested Itineraries:** Each City Stop contains its own unique **Activities**, ensuring costs are tracked accurately by location.
- **Dynamic Budgeting:** Real-time cost aggregation through SQL queries, providing a visual breakdown of your travel spending.


Users can:- 
create trips
- add cities and activities
- manage budgets
- make packing checklists
- share trip plans

## Tech StackFrontend:
- React
- Vite (Fast HMR)
- Tailwind CSS (Responsive Design)
- Recharts (Dynamic Budget Pie Charts)

**Backend:**
- Node.js
- Express

**Database:**
- PostgreSQL (Chosen for relational data integrity)

**Features**
- User authentication - JWT-based user authentication
- Hierarchical Trip planning - Add multiple cities to a single trip and manage specific activities for each.
- Multi-city itineraries
- Intelligent Budget tracking - Automated cost tracking and category-wise spending charts.
- Packing checklist - Trip-specific checklists to ensure travel readiness.Shareable trip links
- Responsive UI
- Collaboration
- Generate unique read-only share links for friends and family.

## FOLDER STRUCTURE 
client/ -> frontendserver/ -> backend APIdatabase/ -> database related filesdocs/ -> notes and planning
