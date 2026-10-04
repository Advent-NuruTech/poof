MASTER PRODUCT PLAYBOOK

Automated YouTube-Powered Video Platform

1. PRODUCT OBJECTIVE

Build a video-first website where YouTube is the primary source of video content, while the website provides a superior, organized, searchable and branded viewing experience.

The core principle is:

««A video should only need to be uploaded to YouTube once. The website should automatically discover, organize, synchronize and display it without manual entry.»»

The website must support multiple YouTube channels and automatically reproduce their playlists and videos within the website.

Administrators should manage channels and synchronization rules, not individual videos.

---

2. CORE PRODUCT PRINCIPLE

The system must treat YouTube as the authoritative source for:

- Videos
- Video titles
- Video descriptions
- Thumbnails
- Publication dates
- Playlists
- Playlist names
- Playlist descriptions
- Playlist membership
- Playlist ordering
- Channel identity
- Public video information

The website maintains a synchronized representation of this information for fast presentation and organization.

The website must NOT require an administrator to manually:

- Upload the video again
- Enter the video title
- Copy the description
- Upload the thumbnail
- Create a website playlist
- Add individual videos to playlists
- Re-enter publication dates

---

3. ADMIN: ADDING A YOUTUBE CHANNEL

The administrator must have:

Admin → YouTube Channels → Add Channel

The administrator should be able to provide either:

- YouTube channel URL
- YouTube channel handle
- YouTube channel ID

The system must validate the channel before adding it.

After successful validation, display:

- Channel name
- Channel image
- Channel ID
- Channel URL
- Number of available playlists
- Number of available videos
- Synchronization status
- Last synchronization time

The administrator confirms:

Add & Synchronize

The system then performs the initial synchronization automatically.

---

4. MULTIPLE CHANNEL SUPPORT

The product must support an unlimited practical number of configured YouTube channels, subject to API/service limitations.

Do NOT hard-code a single YouTube channel into the application.

Every channel must be represented as an independently configurable source.

Example:

- Pioneers of Our Faith
- Youth Ministry
- Children's Ministry
- Camp Meeting
- Music Ministry
- Evangelism

Each channel can independently be:

- Enabled
- Disabled
- Synchronized
- Paused
- Removed from the website
- Resynchronized

Removing a channel from the website must not delete the original YouTube content.

---

5. AUTOMATIC PLAYLIST DISCOVERY

Once a channel is added, the system must automatically discover the channel's YouTube playlists.

For every discovered playlist, automatically capture:

- Playlist ID
- Playlist title
- Playlist description
- Playlist thumbnail
- Channel association
- Publication information
- Number of videos where available
- Playlist URL
- Current synchronization status

The website must automatically create the corresponding website playlist representation.

Critical requirement

Administrators must NOT have to manually create website playlists.

If a new playlist is created on YouTube, the website should automatically discover and create its corresponding playlist during the next synchronization.

---

6. AUTOMATIC PLAYLIST UPDATES

The synchronization system must detect changes to existing playlists.

If a YouTube playlist:

- Gets a new video
- Loses a video
- Changes video order
- Changes its title
- Changes its description
- Changes its thumbnail

the website representation must eventually reflect those changes automatically.

The YouTube playlist should remain the source of truth.

---

7. AUTOMATIC VIDEO DISCOVERY

Every synchronized channel must automatically discover new videos.

When a new video is published on YouTube:

YouTube upload
       ↓
Automatic discovery
       ↓
Website synchronization
       ↓
Video becomes available
       ↓
Appears in Latest Videos

No administrator action should be required.

The system must identify videos using their unique YouTube video ID.

The same YouTube video must never be accidentally duplicated in the website database.

---

8. VIDEO METADATA SYNCHRONIZATION

For every video, automatically synchronize the appropriate publicly available metadata, including:

- YouTube video ID
- Title
- Description
- Thumbnail
- Publication date
- Channel
- Playlist relationships
- Duration
- Public statistics where available
- YouTube URL
- Availability/status information

The website must not invent or overwrite YouTube's title or description unless an explicit product-level override has been configured.

---

9. VIDEO PLAYER

The website must use YouTube's supported embedded player experience.

The website should provide a branded viewing environment around the player rather than attempting to re-host the YouTube video unnecessarily.

The viewing page should contain:

- Video player
- Video title
- Description
- Channel
- Publication date
- Related videos
- Playlist context
- Previous/next controls where applicable
- Share functionality
- Appropriate loading states
- Error states

The website must gracefully handle videos that are:

- Private
- Deleted
- Unavailable
- No longer embeddable
- Region restricted
- Otherwise unavailable

---

10. LATEST VIDEOS

The website must have a dedicated:

Latest Videos

section.

It should automatically display newly discovered videos based on publication date.

The administrator must not manually add videos to this section.

Possible filters:

- All channels
- Individual channel
- Category
- Playlist
- Date
- Topic

The newest available content should naturally rise to the top.

---

11. PLAYLIST EXPERIENCE

Every synchronized YouTube playlist should have a dedicated website page.

Example:

2026 CAMP MEETING

Description

[Playlist thumbnail]

12 Videos

1. Opening Service
2. The Three Angels' Messages
3. Sabbath Worship
4. Prophecy Seminar
5. ...

The website must preserve the playlist's intended order.

Users should be able to:

- Open a playlist
- Start watching
- Move to the next video
- Move to the previous video
- See all videos in the playlist
- Continue watching from the selected video

---

12. CHANNEL EXPERIENCE

Every synchronized channel should have a website representation.

Example:

PIONEERS OF OUR FAITH

Channel description

Latest Videos
Playlists
All Videos

A channel page should allow users to browse:

- Latest videos
- Playlists
- All available videos
- Relevant content categories

---

13. AUTOMATIC CATEGORY ORGANIZATION

The system should support optional website categories without requiring administrators to manually categorize every video.

Possible classification methods include:

Playlist-based classification

Example:

YouTube playlist:

Bible Prophecy

Website category:

Bible Prophecy

Keyword-based classification

Example:

Title:

Daniel 7 Bible Study

Category:

Bible Study

Administrator rules

Administrators should be able to define optional rules such as:

If playlist = "Youth"
→ Category = Youth

If title contains "Sabbath School"
→ Category = Sabbath School

Manual categorization should be an exception, not the normal workflow.

---

14. SEARCH

The website must provide powerful video discovery.

Users should be able to search:

- Video titles
- Descriptions
- Channels
- Playlists
- Categories
- Speakers where available
- Topics
- Dates

Search results should prioritize relevant and recent content.

The system should search its synchronized catalogue first rather than making every visitor directly query YouTube.

---

15. HOME PAGE

The home page should dynamically present video content.

Recommended sections:

Hero / Featured Video

A prominent video or live broadcast.

Latest Videos

Automatically populated.

Featured Playlists

Automatically populated or optionally curated.

Popular Videos

Based on available public statistics or website viewing behavior.

Channels

A browsable list of configured content sources.

Categories

Bible Study, Sermons, Sabbath School, Youth, Music, Children, Prophecy, Camp Meeting, etc.

The administrator should be able to choose which sections appear without manually maintaining video lists.

---

16. LIVE CONTENT

The system should support YouTube live broadcasts where available.

When a configured channel is live:

- Detect the live broadcast
- Mark it clearly as LIVE
- Surface it prominently
- Provide a live viewing page
- Remove/transition the LIVE state when the broadcast ends

The product should distinguish between:

- Upcoming live stream
- Currently live
- Completed broadcast

---

17. AUTOMATIC SYNCHRONIZATION

Synchronization must be automatic.

The system should periodically check configured channels and playlists.

Synchronization must cover:

Channel level

- New playlists
- Removed playlists
- Channel metadata changes where relevant

Playlist level

- New videos
- Removed videos
- Reordered videos
- Metadata changes

Video level

- Title changes
- Description changes
- Thumbnail changes
- Availability changes
- Public metadata changes

The exact synchronization frequency should be configurable based on operational requirements.

The system should also support an administrator-triggered:

Sync Now

button.

---

18. INCREMENTAL SYNCHRONIZATION

Do not repeatedly rebuild the entire catalogue unnecessarily.

The system should intelligently determine what has changed.

For example:

Last synchronization:
10:00

Current synchronization:
10:15

Only check for changes since the previous successful synchronization.

Where the source/API permits incremental synchronization, use it.

The system should minimize unnecessary external API calls.

---

19. DUPLICATE PREVENTION

The YouTube video ID must be treated as the unique identity of a video.

If the same video appears in:

- Multiple playlists
- Multiple website sections
- Search results
- A channel's uploads

it must still represent one video, not multiple copies.

Playlist membership should be stored separately from the video itself.

This is extremely important.

Correct:

ONE VIDEO
 ├── Playlist A
 ├── Playlist B
 └── Latest Videos

Incorrect:

Video A copy
Video A copy
Video A copy

---

20. PLAYLIST/VIDEO RELATIONSHIP

A video may belong to multiple playlists.

Therefore, do not design the system assuming:

One video = One playlist

Instead:

Video
  ↓
Multiple playlist relationships

The system must preserve these relationships accurately.

---

21. DATA CONSISTENCY

The website should distinguish between:

Source data

Information coming from YouTube.

Website presentation data

Information used by the website to organize and display content.

Administrative configuration

Rules created by website administrators.

This prevents website-specific configuration from accidentally overwriting source information.

---

22. ADMIN DASHBOARD

The administrator dashboard should provide:

Channels

- Add channel
- Remove channel
- Enable/disable synchronization
- View synchronization status
- Sync now
- View last synchronization
- View errors

Playlists

- View automatically discovered playlists
- Hide a playlist from the website
- Feature a playlist
- Assign optional website category
- View synchronization status

Videos

- View synchronized videos
- Hide a video
- Feature a video
- View source playlist(s)
- View synchronization status

The administrator should not need to manually enter basic YouTube metadata.

---

23. ADMIN OVERRIDES

The product should support optional overrides without destroying synchronized source data.

For example:

YouTube title:

Daniel 7 Bible Study

Website display title:

Daniel 7 — Understanding the Prophecy

Store both values separately.

Never overwrite the original source metadata.

This allows the website to remain synchronized while still providing editorial control.

---

24. ERROR HANDLING

The system must never silently fail.

If synchronization fails, administrators should see:

- Which channel failed
- What operation failed
- When it failed
- Error category
- Whether the system will retry
- Last successful synchronization

Example:

PIONEERS OF OUR FAITH

Status: ⚠ Sync issue

Last successful sync:

10:15 AM

Problem:

Temporary YouTube API request failure

Next retry:

Automatic

Temporary failures should be retried automatically.

---

25. DELETED OR UNAVAILABLE VIDEOS

If a YouTube video disappears, the website should not immediately destroy historical records blindly.

Instead, mark it appropriately:

- Unavailable
- Deleted
- Private
- No longer embeddable

The website can then decide whether to:

- Hide it from public listings
- Preserve historical references
- Show an unavailable message

This prevents broken references and unnecessary data loss.

---

26. PERFORMANCE

The website must not make YouTube API requests for every website visitor.

Correct architecture:

                 YouTube
                    ↓
            Synchronization
                    ↓
              Website data
                    ↓
          Thousands of visitors

Not:

10,000 visitors
      ↓
10,000 direct YouTube API requests

The synchronized catalogue should be optimized for fast website browsing.

---

27. CACHING AND API QUOTA PROTECTION

The system must minimize unnecessary YouTube API usage.

Requirements:

- Cache synchronized metadata
- Avoid repeated identical requests
- Use incremental synchronization
- Avoid search requests when existing synchronized data is sufficient
- Paginate large channel/playlist collections
- Monitor API usage
- Handle quota exhaustion gracefully

The website must continue serving already synchronized content even if a temporary YouTube API quota or connectivity problem occurs.

---

28. SCALABILITY

The system should be designed from the beginning to support:

1 channel
        ↓
10 channels
        ↓
100 channels
        ↓
Large video catalogue
        ↓
Large number of website visitors

Adding another YouTube channel should not require:

- Code changes
- Redeployment
- Database redesign
- Manual playlist creation

It should be an administrative operation.

---

29. SECURITY

YouTube credentials/API credentials must never be exposed to website visitors.

Sensitive credentials must remain server-side.

The public website should only receive the information necessary to display content.

Administrator functions must require proper authentication and authorization.

Only authorized administrators should be able to:

- Add channels
- Remove channels
- Change synchronization settings
- Feature/hide content
- Modify website-specific overrides

---

30. SOURCE OF TRUTH

The following rule must be strictly enforced:

YouTube owns:

- Original video
- Original title
- Original description
- Original thumbnail
- Playlist membership
- Playlist order
- Publication information

Website owns:

- Featured status
- Visibility on the website
- Website category
- Website-specific display title
- Website-specific organization
- Editorial ranking
- Website analytics

This separation prevents synchronization conflicts.

---

31. AUTOMATIC CONTENT LIFECYCLE

The entire content lifecycle should be:

CREATOR
   ↓
Uploads video to YouTube
   ↓
Adds video to YouTube playlist
   ↓
YouTube becomes source
   ↓
Automatic synchronization
   ↓
Website discovers video
   ↓
Metadata synchronized
   ↓
Video appears in:
   • Latest Videos
   • Channel
   • Playlist
   • Search
   • Category
   ↓
Users watch video

No manual website upload should be required.

---

32. EXAMPLE REAL-WORLD WORKFLOW

An administrator adds:

PIONEERS OF OUR FAITH
YouTube Channel

The system automatically discovers:

15 Playlists
320 Videos

The website immediately creates representations of those playlists and videos.

One week later, the channel uploads:

Sabbath Worship Service
October 11, 2026

and adds it to:

Sabbath Services

The system automatically discovers:

NEW VIDEO
       ↓
Sabbath Services playlist updated
       ↓
Channel updated
       ↓
Latest Videos updated
       ↓
Search index updated
       ↓
Category updated

Nobody logs into the website to enter the video.

---

33. ADMIN EXPERIENCE PRINCIPLE

The administrator should manage sources and rules, not content duplication.

The desired administrative workflow is:

Add Channel
     ↓
Enable Sync
     ↓
System discovers everything
     ↓
System continuously maintains everything

Not:

Add Channel
Create Playlist
Upload Video
Enter Title
Enter Description
Upload Thumbnail
Assign Category
Repeat

The second workflow should be avoided.

---

34. OPTIONAL EDITORIAL CONTROL

Automation should not eliminate editorial control.

Administrators should be able to:

- Feature a video
- Feature a playlist
- Hide content
- Change website category
- Create homepage collections
- Override website display titles
- Pin important content
- Mark special broadcasts

But these actions should be optional editorial enhancements, not requirements for basic synchronization.

---

35. USER EXPERIENCE REQUIREMENT

From the user's perspective, the website should feel like a complete, independent video platform.

The user should not need to understand:

- API synchronization
- Channel IDs
- YouTube API quotas
- Database synchronization
- Backend jobs

They should simply see:

Videos | Playlists | Channels | Categories | Search | Live | Latest | Featured

and watch content normally.

---

36. RELIABILITY REQUIREMENT

The website should remain usable even when YouTube synchronization temporarily fails.

Previously synchronized content should remain available in the website catalogue.

The synchronization system should recover automatically when the external service becomes available again.

---

37. OBSERVABILITY

Administrators should have visibility into the synchronization system.

Provide:

- Total channels
- Total playlists
- Total videos
- Last successful synchronization
- Currently synchronizing
- Failed synchronizations
- Number of new videos discovered
- Number of changed videos
- Number of removed/unavailable videos
- API usage/health where available

A synchronization history should be available for troubleshooting.

---

38. FINAL PRODUCT REQUIREMENT

The finished product must achieve this experience:

««Upload to YouTube once, and the website takes care of the rest.»»

Adding a YouTube channel should be the only initial manual content operation.

After that:

YouTube Channels → Playlists → Videos → Metadata → Website

must be automatically synchronized.

---

39. NON-NEGOTIABLE ACCEPTANCE CRITERIA

The engineering implementation should not be considered complete until all of the following work:

Channel management

- [ ] Admin can add a YouTube channel without code changes.
- [ ] Multiple channels are supported.
- [ ] Channels can be enabled/disabled.
- [ ] Channel synchronization status is visible.

Playlist automation

- [ ] Playlists are automatically discovered.
- [ ] No manual website playlist creation is required.
- [ ] New YouTube playlists appear automatically.
- [ ] Playlist metadata is synchronized.
- [ ] Playlist ordering is preserved.

Video automation

- [ ] New YouTube videos are automatically discovered.
- [ ] Titles synchronize automatically.
- [ ] Descriptions synchronize automatically.
- [ ] Thumbnails synchronize automatically.
- [ ] Publication dates synchronize automatically.
- [ ] Video IDs are tracked uniquely.
- [ ] Duplicate videos are prevented.

Relationships

- [ ] Videos can belong to multiple playlists.
- [ ] Channel → playlist → video relationships remain accurate.
- [ ] Removing a video from one playlist does not incorrectly delete the video itself.

Website

- [ ] Latest Videos updates automatically.
- [ ] Channel pages update automatically.
- [ ] Playlist pages update automatically.
- [ ] Search updates automatically.
- [ ] Categories can be automated.
- [ ] Live content can be surfaced automatically.

Administration

- [ ] Admin can manually trigger synchronization.
- [ ] Admin can feature/hide content.
- [ ] Admin can apply website-specific overrides.
- [ ] Source YouTube data is preserved separately from website overrides.

Reliability

- [ ] Temporary synchronization failures retry automatically.
- [ ] Previously synchronized content remains available during synchronization failures.
- [ ] Deleted/private/unavailable videos are handled gracefully.
- [ ] Synchronization errors are visible to administrators.

Scalability

- [ ] No channel IDs are hard-coded.
- [ ] Adding a channel requires no deployment.
- [ ] Visitors do not individually consume YouTube API quota.
- [ ] Synchronization is incremental and efficient.
- [ ] Duplicate API requests are minimized.

---

40. THE GOLD STANDARD

The engineering team should build toward this final behavior:

                    YOUTUBE
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     CHANNELS       PLAYLISTS       VIDEOS
        │              │              │
        └──────────────┼──────────────┘
                       ↓
               AUTOMATIC SYNC
                       ↓
              WEBSITE CATALOGUE
                       ↓
        ┌──────────────┼──────────────┐
        │              │              │
      SEARCH         PLAYLISTS      CHANNELS
        │              │              │
        └──────────────┼──────────────┘
                       ↓
                VIDEO EXPERIENCE
                       ↓
                    USERS

Product philosophy

YouTube should be the content source.

The website should be the discovery, organization, branding and viewing experience.

Administrators should configure sources and editorial rules.

The system should do the repetitive content work automatically.

No manual video-by-video uploading or playlist creation should be required.