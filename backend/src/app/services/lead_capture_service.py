"""
Lead Capture Service - Unified lead capture across all platforms.

WHY:
- Centralize lead capture logic for Widget, Telegram, Discord, WhatsApp
- Handle platform-specific data extraction
- Ensure consistent consent tracking
- Support lead deduplication by email

HOW:
- Platform-specific capture methods extract available data
- Common _create_or_merge_lead handles storage and dedup
- Consent tracking for GDPR compliance
- Geolocation for web-based leads

PSEUDOCODE follows existing codebase patterns.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.lead import Lead, LeadStatus


class LeadCaptureService:
    """
    Unified lead capture service for all deployment platforms.

    WHY: Consistent lead handling across widget, telegram, discord, whatsapp
    HOW: Platform-specific extractors + common storage logic
    """

    async def capture_from_widget(
        self,
        db: Session,
        workspace_id: UUID,
        bot_id: UUID,
        bot_type: str,
        session_id: str,
        email: Optional[str] = None,
        name: Optional[str] = None,
        phone: Optional[str] = None,
        custom_fields: Optional[Dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        referrer: Optional[str] = None,
        language: Optional[str] = None,
        consent_given: bool = False
    ) -> Lead:
        """
        Capture lead from website widget.

        WHY: Widget provides IP, user agent, referrer for geolocation
        HOW: Extract web metadata, create lead with consent

        ARGS:
            db: Database session
            workspace_id: Workspace UUID
            bot_id: Chatbot/Chatflow UUID
            bot_type: "chatbot" or "chatflow"
            session_id: Chat session ID
            email: User's email (optional - visitors can skip lead form)
            name: User's name (optional)
            phone: User's phone (optional)
            custom_fields: Additional fields (optional)
            ip_address: For geolocation
            user_agent: Browser/device info
            referrer: Where user came from
            language: Browser language
            consent_given: Whether user consented

        RETURNS:
            Created or merged Lead
        """

        # Get geolocation from IP
        geolocation = None
        if ip_address:
            from app.services.geoip_service import geoip_service
            geolocation = geoip_service.lookup(ip_address)

        lead_data = {
            "workspace_id": workspace_id,
            "bot_id": bot_id,
            "bot_type": bot_type,
            "session_id": session_id,
            "email": email,  # Can be None - visitors can skip lead form
            "name": name,
            "phone": phone,
            "custom_fields": custom_fields or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
            "referrer": referrer,
            "language": language,
            "channel": "website",  # Widget is deployed on website
            "consent_given": "Y" if consent_given else "N",
            "consent_method": "form" if consent_given else None,
            "consent_timestamp": datetime.utcnow() if consent_given else None,
            "data_processing_agreed": "Y" if consent_given else "N",
        }

        # Add geolocation if available
        if geolocation:
            lead_data["country"] = geolocation.get("country")
            lead_data["country_code"] = geolocation.get("country_code")
            lead_data["region"] = geolocation.get("region")
            lead_data["city"] = geolocation.get("city")
            lead_data["timezone"] = geolocation.get("timezone")

        return await self._create_or_merge_lead(db, lead_data)

    async def capture_from_telegram(
        self,
        db: Session,
        workspace_id: UUID,
        bot_id: UUID,
        bot_type: str,
        session_id: str,
        telegram_user_id: str,
        telegram_username: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        consent_given: bool = False
    ) -> Lead:
        """
        Capture lead from Telegram.

        WHY: Telegram provides user_id, username, first_name, last_name
        HOW: Store Telegram-specific data in custom_fields

        NOTE: Telegram does NOT provide email/phone automatically.
              Must be collected via conversation or contact sharing.

        ARGS:
            telegram_user_id: Telegram's unique user ID
            telegram_username: @username (if public)
            first_name: User's first name
            last_name: User's last name
            email: Only if collected via conversation
            phone: Only if user shared contact
            consent_given: Whether user consented

        RETURNS:
            Created or merged Lead
        """

        # Build name from Telegram data
        name = None
        if first_name:
            name = first_name
            if last_name:
                name = f"{first_name} {last_name}"

        lead_data = {
            "workspace_id": workspace_id,
            "bot_id": bot_id,
            "bot_type": bot_type,
            "session_id": session_id,
            "email": email,  # Can be None - collected later via conversation
            "name": name,
            "phone": phone,
            "custom_fields": {
                "telegram_user_id": telegram_user_id,
                "telegram_username": telegram_username,
                "platform_source": "telegram"
            },
            "channel": "telegram",
            "consent_given": "Y" if consent_given else "N",
            "consent_method": "chat" if consent_given else None,
            "consent_timestamp": datetime.utcnow() if consent_given else None,
            "data_processing_agreed": "Y" if consent_given else "N",
        }

        return await self._create_or_merge_lead(db, lead_data)

    async def capture_from_discord(
        self,
        db: Session,
        workspace_id: UUID,
        bot_id: UUID,
        bot_type: str,
        session_id: str,
        discord_user_id: str,
        discord_username: str,
        discord_discriminator: Optional[str] = None,
        guild_id: Optional[str] = None,
        guild_name: Optional[str] = None,
        email: Optional[str] = None,
        consent_given: bool = False
    ) -> Lead:
        """
        Capture lead from Discord.

        WHY: Discord provides user context + guild (B2B valuable)
        HOW: Store Discord-specific data, guild context for enterprise leads

        NOTE: Discord does NOT provide email automatically.
              Must use modal interaction to collect.

        ARGS:
            discord_user_id: Discord's unique user ID (snowflake)
            discord_username: Username
            discord_discriminator: #0000 (legacy, may be null)
            guild_id: Server ID (B2B context)
            guild_name: Server name
            email: Only if collected via modal
            consent_given: Whether user consented

        RETURNS:
            Created or merged Lead
        """

        lead_data = {
            "workspace_id": workspace_id,
            "bot_id": bot_id,
            "bot_type": bot_type,
            "session_id": session_id,
            "email": email,  # Can be None - collected via modal
            "name": discord_username,
            "custom_fields": {
                "discord_user_id": discord_user_id,
                "discord_username": discord_username,
                "discord_discriminator": discord_discriminator,
                "guild_id": guild_id,
                "guild_name": guild_name,
                "platform_source": "discord"
            },
            "channel": "discord",
            "consent_given": "Y" if consent_given else "N",
            "consent_method": "chat" if consent_given else None,
            "consent_timestamp": datetime.utcnow() if consent_given else None,
            "data_processing_agreed": "Y" if consent_given else "N",
        }

        return await self._create_or_merge_lead(db, lead_data)

    async def capture_from_whatsapp(
        self,
        db: Session,
        workspace_id: UUID,
        bot_id: UUID,
        bot_type: str,
        session_id: str,
        phone: str,
        wa_id: Optional[str] = None,
        profile_name: Optional[str] = None,
        email: Optional[str] = None,
        consent_given: bool = False
    ) -> Lead:
        """
        Capture lead from WhatsApp.

        WHY: WhatsApp provides VERIFIED phone number - highest value lead!
        HOW: Auto-capture phone on first message (with consent)

        CRITICAL: WhatsApp phone numbers are verified by WhatsApp.
                  This is the MOST valuable lead source.

        ARGS:
            phone: Verified phone number (e.g., "1234567890")
            wa_id: WhatsApp ID (usually same as phone)
            profile_name: User's WhatsApp profile name
            email: Only if collected via conversation
            consent_given: Whether user consented

        RETURNS:
            Created or merged Lead
        """

        lead_data = {
            "workspace_id": workspace_id,
            "bot_id": bot_id,
            "bot_type": bot_type,
            "session_id": session_id,
            "email": email,  # Can be None - collected via conversation
            "name": profile_name,
            "phone": phone,  # VERIFIED by WhatsApp!
            "custom_fields": {
                "whatsapp_id": wa_id or phone,
                "whatsapp_profile_name": profile_name,
                "phone_verified": True,  # WhatsApp verifies phone ownership
                "platform_source": "whatsapp"
            },
            "channel": "whatsapp",
            "consent_given": "Y" if consent_given else "N",
            "consent_method": "chat" if consent_given else None,
            "consent_timestamp": datetime.utcnow() if consent_given else None,
            "data_processing_agreed": "Y" if consent_given else "N",
        }

        return await self._create_or_merge_lead(db, lead_data)

    async def auto_capture_whatsapp_phone(
        self,
        db: Session,
        workspace_id: UUID,
        bot_id: UUID,
        bot_type: str,
        session_id: str,
        phone: str,
        profile_name: Optional[str] = None,
        consent_given: bool = True  # Default True for WhatsApp auto-capture
    ) -> Lead:
        """
        Auto-capture phone from WhatsApp on first message.

        WHY: WhatsApp's strength is verified phone - capture immediately
        HOW: Create lead with phone only, prompt for email later

        This is called automatically when lead_capture_config.auto_capture_phone = True
        """

        return await self.capture_from_whatsapp(
            db=db,
            workspace_id=workspace_id,
            bot_id=bot_id,
            bot_type=bot_type,
            session_id=session_id,
            phone=phone,
            profile_name=profile_name,
            consent_given=consent_given
        )

    async def capture_lead(
        self,
        db: Session,
        workspace_id: UUID,
        bot_id: UUID,
        bot_type: str,
        session_id: str,
        channel: str,
        email: Optional[str] = None,
        name: Optional[str] = None,
        phone: Optional[str] = None,
        custom_fields: Optional[Dict] = None,
        consent_given: bool = False,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        referrer: Optional[str] = None,
        language: Optional[str] = None
    ) -> Lead:
        """
        Generic lead capture for any channel (Slack, Calendly, etc.).

        WHY: Platform-specific methods exist for Widget/Telegram/Discord/WhatsApp,
             but new integrations (Slack, Calendly) need a generic entry point.
        HOW: Build lead_data dict and delegate to _create_or_merge_lead.
        """
        lead_data = {
            "workspace_id": workspace_id,
            "bot_id": bot_id,
            "bot_type": bot_type,
            "session_id": session_id,
            "email": email,
            "name": name,
            "phone": phone,
            "custom_fields": custom_fields or {},
            "channel": channel,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "referrer": referrer,
            "language": language,
            "consent_given": "Y" if consent_given else "N",
            "consent_timestamp": datetime.utcnow() if consent_given else None,
            "consent_method": f"auto_{channel}" if consent_given else None,
            "data_processing_agreed": "Y" if consent_given else "N",
        }

        return await self._create_or_merge_lead(db, lead_data)

    async def _create_or_merge_lead(
        self,
        db: Session,
        lead_data: Dict[str, Any]
    ) -> Lead:
        """
        Create new lead or merge with existing.

        WHY: Prevent duplicates, enrich existing leads with new data
        HOW: Check for existing lead by email or session_id, merge if found

        DEDUPLICATION STRATEGY:
        1. If email provided: Merge by email (same email = same person)
        2. If no email: Check by session_id (same session = same visitor)
        - New platform data enriches existing record
        - WhatsApp phone takes priority (verified)
        """

        email = lead_data.get("email")
        session_id = lead_data.get("session_id")
        workspace_id = lead_data.get("workspace_id")

        existing_lead = None

        # Strategy 1: Deduplicate by email if provided
        if email:
            existing_lead = db.query(Lead).filter(
                Lead.workspace_id == workspace_id,
                Lead.email == email
            ).first()

        # Strategy 2: Deduplicate by session_id if no email match
        if not existing_lead and session_id:
            existing_lead = db.query(Lead).filter(
                Lead.workspace_id == workspace_id,
                Lead.session_id == session_id
            ).first()

        if existing_lead:
            # Merge: Update with new platform data
            return await self._merge_lead(db, existing_lead, lead_data)

        # Create new lead
        lead = Lead(
            workspace_id=lead_data["workspace_id"],
            bot_id=lead_data["bot_id"],
            bot_type=lead_data["bot_type"],
            session_id=lead_data.get("session_id"),
            email=lead_data["email"],
            name=lead_data.get("name"),
            phone=lead_data.get("phone"),
            custom_fields=lead_data.get("custom_fields", {}),
            ip_address=lead_data.get("ip_address"),
            country=lead_data.get("country"),
            country_code=lead_data.get("country_code"),
            region=lead_data.get("region"),
            city=lead_data.get("city"),
            timezone=lead_data.get("timezone"),
            channel=lead_data.get("channel"),
            referrer=lead_data.get("referrer"),
            user_agent=lead_data.get("user_agent"),
            language=lead_data.get("language"),
            consent_given=lead_data.get("consent_given", "N"),
            consent_timestamp=lead_data.get("consent_timestamp"),
            consent_method=lead_data.get("consent_method"),
            data_processing_agreed=lead_data.get("data_processing_agreed", "N"),
            status=LeadStatus.NEW
        )

        db.add(lead)
        db.commit()
        db.refresh(lead)

        return lead

    async def _merge_lead(
        self,
        db: Session,
        existing_lead: Lead,
        new_data: Dict[str, Any]
    ) -> Lead:
        """
        Merge new data into existing lead.

        WHY: Enrich leads with data from multiple platforms
        HOW: Update fields, merge custom_fields, track platforms

        MERGE RULES:
        - WhatsApp phone overrides other phone (verified)
        - Name: Keep existing if set, else use new
        - custom_fields: Merge, track all platforms
        - Geolocation: Only update if not set
        """

        channel = new_data.get("channel")

        # Track which platforms this lead came from
        platforms = existing_lead.custom_fields.get("platforms", [])
        if channel and channel not in platforms:
            platforms.append(channel)

        # Merge custom_fields
        merged_custom_fields = existing_lead.custom_fields or {}
        new_custom_fields = new_data.get("custom_fields", {})

        # Add platform-specific data
        if channel == "telegram":
            merged_custom_fields["telegram_user_id"] = new_custom_fields.get("telegram_user_id")
            merged_custom_fields["telegram_username"] = new_custom_fields.get("telegram_username")
        elif channel == "discord":
            merged_custom_fields["discord_user_id"] = new_custom_fields.get("discord_user_id")
            merged_custom_fields["discord_username"] = new_custom_fields.get("discord_username")
            merged_custom_fields["guild_id"] = new_custom_fields.get("guild_id")
            merged_custom_fields["guild_name"] = new_custom_fields.get("guild_name")
        elif channel == "whatsapp":
            merged_custom_fields["whatsapp_id"] = new_custom_fields.get("whatsapp_id")
            merged_custom_fields["phone_verified"] = True

        merged_custom_fields["platforms"] = platforms

        # Update lead
        existing_lead.custom_fields = merged_custom_fields

        # WhatsApp phone takes priority (verified)
        if channel == "whatsapp" and new_data.get("phone"):
            existing_lead.phone = new_data["phone"]
        elif not existing_lead.phone and new_data.get("phone"):
            existing_lead.phone = new_data["phone"]

        # Name: Keep existing if set
        if not existing_lead.name and new_data.get("name"):
            existing_lead.name = new_data["name"]

        # Update consent if given
        if new_data.get("consent_given") == "Y":
            existing_lead.consent_given = "Y"
            existing_lead.consent_timestamp = new_data.get("consent_timestamp")
            existing_lead.consent_method = new_data.get("consent_method")
            existing_lead.data_processing_agreed = "Y"

        # Geolocation: Only update if not set
        if not existing_lead.country and new_data.get("country"):
            existing_lead.country = new_data["country"]
            existing_lead.country_code = new_data.get("country_code")
            existing_lead.region = new_data.get("region")
            existing_lead.city = new_data.get("city")
            existing_lead.timezone = new_data.get("timezone")

        db.commit()
        db.refresh(existing_lead)

        return existing_lead

    async def check_lead_exists(
        self,
        db: Session,
        workspace_id: UUID,
        session_id: str
    ) -> Optional[Lead]:
        """
        Check if lead already exists for this session.

        WHY: Prevent duplicate prompts for lead capture
        HOW: Query by session_id

        RETURNS:
            Lead if exists, None otherwise
        """

        return db.query(Lead).filter(
            Lead.workspace_id == workspace_id,
            Lead.session_id == session_id
        ).first()

    async def update_lead_email(
        self,
        db: Session,
        workspace_id: UUID,
        session_id: str,
        email: str
    ) -> Optional[Lead]:
        """
        Update lead email (when collected via conversation).

        WHY: Leads from Telegram/Discord/WhatsApp may not have email initially
        HOW: Find by session, update email, check for merge

        RETURNS:
            Updated Lead
        """

        # Find lead by session
        lead = await self.check_lead_exists(db, workspace_id, session_id)
        if not lead:
            return None

        # Check if email already exists (potential merge)
        existing_by_email = db.query(Lead).filter(
            Lead.workspace_id == workspace_id,
            Lead.email == email,
            Lead.id != lead.id
        ).first()

        if existing_by_email:
            # Merge into existing lead, delete current
            merged_lead = await self._merge_lead(db, existing_by_email, {
                "channel": lead.channel,
                "custom_fields": lead.custom_fields,
                "phone": lead.phone,
                "name": lead.name,
                "consent_given": lead.consent_given,
                "consent_timestamp": lead.consent_timestamp,
                "consent_method": lead.consent_method,
            })

            # Delete the duplicate
            db.delete(lead)
            db.commit()

            return merged_lead

        # Just update email
        lead.email = email
        db.commit()
        db.refresh(lead)

        return lead


# Global singleton instance
lead_capture_service = LeadCaptureService()
