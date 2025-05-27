# Web Share Feature Plan

A step-by-step checklist for implementing the new Web Share feature.

## User Flow
- [ ] User clicks the new "Web Share" icon/button.
- [x] Backend finds the latest generated HTML report(s) and all images referenced in them.
- [x] Backend uploads the HTML and images to Supabase Storage, organized by user and project.
- [x] Backend returns public URLs for the HTML and images.
- [ ] Frontend displays the public share URL(s) to the user for easy sharing.
- [ ] (Optional) Frontend shows a list of previously shared reports for the project.

## Supabase Storage Structure
- [x] Use the following path: `public/{user_id}/{project_id}/{share_id}/index.html`
- [x] Images: `public/{user_id}/{project_id}/{share_id}/img_xxx.webp` (and other images)

## Backend Implementation
- [x] Add API endpoint: `POST /api/share-report`
  - [x] Input: project_id, user_id, (optionally: thread_id or report_id)
  - [x] Find all HTML reports in the workspace directory (may be multiple, e.g., English and Chinese versions)
  - [x] Parse each HTML to find all image references
  - [x] Upload HTML and all referenced images to Supabase Storage under the correct path
  - [x] Make all files public and return the public URL(s)
- [x] Use Supabase Storage SDK (Python) to upload files and get public URLs

## Frontend Implementation
- [ ] Add a "Web Share" button/icon next to the current share/sandbox share
- [ ] On click, call the new API endpoint
- [ ] Show a modal or toast with the public share URL(s) and a "Copy Link" button
- [ ] (Optional) Show a list of previously shared reports for the project

## (Future) Community Section
- [ ] Build a page that lists all public shared HTMLs, organized by project/user, with previews

---

**Instructions:**
- As you implement each item, mark it as checked `[x]`.
- Use this file as your living checklist for the Web Share feature. 