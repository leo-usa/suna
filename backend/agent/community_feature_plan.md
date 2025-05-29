# Community Feature Plan

A step-by-step checklist for implementing the Community gallery for shared HTML works.

## Database & Backend
- [x] Create `community_posts` table (id, user_id, user_name, title, html_path, created_at, like_count, etc.)
- [x] Add API endpoint: `POST /api/community/share` (share a report to the community)
- [x] Add API endpoint: `GET /api/community` (list all community posts)
- [x] Add API endpoint: `POST /api/community/like` (like a post)
- [x] Store shared HTMLs in a single `community/` folder in Supabase Storage
- [x] Store images in `community/images/` or embed as data URLs

## Frontend
- [ ] Add Community section/page to the home/dashboard
- [ ] Display grid/list of shared works (thumbnail, title, user name, like count)
- [ ] Open HTML in new tab or modal on click
- [ ] Add like button for each post (calls like API)
- [ ] Add share flow: prompt for title, call share API

## User Experience
- [ ] Display user's name on their work
- [ ] Optionally link to user profile or show more works by user
- [ ] (Optional) Add moderation/flagging for admin approval

## Index HTML
- [ ] Generate/update a `community/index.html` that links to all shared HTMLs

---

**This checklist will be updated as each step is completed.** 