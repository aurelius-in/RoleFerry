"""
FastAPI router for analytics tracking
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..services.analytics_tracking import analytics_tracking_service, CampaignMetrics, AlignmentCorrelation, PerformanceInsight

router = APIRouter(prefix="/api/analytics-tracking", tags=["analytics-tracking"])


class EmailSentRequest(BaseModel):
    """Request model for tracking email sent"""
    campaign_id: str
    email_id: str
    recipient: str
    alignment_score: float
    timestamp: Optional[datetime] = None


class EmailDeliveredRequest(BaseModel):
    """Request model for tracking email delivered"""
    campaign_id: str
    email_id: str
    timestamp: Optional[datetime] = None


class EmailOpenedRequest(BaseModel):
    """Request model for tracking email opened"""
    campaign_id: str
    email_id: str
    timestamp: Optional[datetime] = None


class EmailRepliedRequest(BaseModel):
    """Request model for tracking email replied"""
    campaign_id: str
    email_id: str
    reply_type: str = "positive"
    timestamp: Optional[datetime] = None


class MeetingScheduledRequest(BaseModel):
    """Request model for tracking meeting scheduled"""
    campaign_id: str
    email_id: str
    timestamp: Optional[datetime] = None


class ROICalculationRequest(BaseModel):
    """Request model for ROI calculation"""
    campaign_id: str
    revenue_generated: float
    costs: float


class CampaignMetricsResponse(BaseModel):
    """Response model for campaign metrics"""
    campaign_id: str
    total_sent: int
    total_delivered: int
    total_opened: int
    total_replied: int
    total_positive: int
    total_meetings: int
    open_rate: float
    reply_rate: float
    positive_rate: float
    meeting_rate: float
    alignment_score: float
    cost_per_lead: float
    cost_per_meeting: float
    roi: float


class AlignmentCorrelationResponse(BaseModel):
    """Response model for alignment correlation"""
    alignment_score: float
    open_rate: float
    reply_rate: float
    positive_rate: float
    correlation_coefficient: float
    sample_size: int


class PerformanceInsightResponse(BaseModel):
    """Response model for performance insight"""
    metric: str
    value: float
    trend: str
    change_percentage: float
    recommendation: str
    priority: str


class TrendAnalysisResponse(BaseModel):
    """Response model for trend analysis"""
    campaign_id: str
    current_metrics: Dict[str, float]
    benchmark_comparison: Dict[str, float]
    performance_grade: str


@router.post("/track-email-sent")
async def track_email_sent(request: EmailSentRequest):
    """Track when an email is sent"""
    try:
        analytics_tracking_service.track_email_sent(
            campaign_id=request.campaign_id,
            email_id=request.email_id,
            recipient=request.recipient,
            alignment_score=request.alignment_score,
            timestamp=request.timestamp
        )
        
        return {"message": "Email sent tracked successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking email sent: {str(e)}")


@router.post("/track-email-delivered")
async def track_email_delivered(request: EmailDeliveredRequest):
    """Track when an email is delivered"""
    try:
        analytics_tracking_service.track_email_delivered(
            campaign_id=request.campaign_id,
            email_id=request.email_id,
            timestamp=request.timestamp
        )
        
        return {"message": "Email delivered tracked successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking email delivered: {str(e)}")


@router.post("/track-email-opened")
async def track_email_opened(request: EmailOpenedRequest):
    """Track when an email is opened"""
    try:
        analytics_tracking_service.track_email_opened(
            campaign_id=request.campaign_id,
            email_id=request.email_id,
            timestamp=request.timestamp
        )
        
        return {"message": "Email opened tracked successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking email opened: {str(e)}")


@router.post("/track-email-replied")
async def track_email_replied(request: EmailRepliedRequest):
    """Track when an email receives a reply"""
    try:
        analytics_tracking_service.track_email_replied(
            campaign_id=request.campaign_id,
            email_id=request.email_id,
            reply_type=request.reply_type,
            timestamp=request.timestamp
        )
        
        return {"message": "Email reply tracked successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking email reply: {str(e)}")


@router.post("/track-meeting-scheduled")
async def track_meeting_scheduled(request: MeetingScheduledRequest):
    """Track when a meeting is scheduled"""
    try:
        analytics_tracking_service.track_meeting_scheduled(
            campaign_id=request.campaign_id,
            email_id=request.email_id,
            timestamp=request.timestamp
        )
        
        return {"message": "Meeting scheduled tracked successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking meeting scheduled: {str(e)}")


@router.get("/campaign-metrics/{campaign_id}", response_model=CampaignMetricsResponse)
async def get_campaign_metrics(campaign_id: str):
    """Get metrics for a specific campaign"""
    try:
        metrics = analytics_tracking_service.get_campaign_metrics(campaign_id)
        
        if not metrics:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return CampaignMetricsResponse(
            campaign_id=metrics.campaign_id,
            total_sent=metrics.total_sent,
            total_delivered=metrics.total_delivered,
            total_opened=metrics.total_opened,
            total_replied=metrics.total_replied,
            total_positive=metrics.total_positive,
            total_meetings=metrics.total_meetings,
            open_rate=metrics.open_rate,
            reply_rate=metrics.reply_rate,
            positive_rate=metrics.positive_rate,
            meeting_rate=metrics.meeting_rate,
            alignment_score=metrics.alignment_score,
            cost_per_lead=metrics.cost_per_lead,
            cost_per_meeting=metrics.cost_per_meeting,
            roi=metrics.roi
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting campaign metrics: {str(e)}")


@router.get("/all-campaigns-metrics", response_model=List[CampaignMetricsResponse])
async def get_all_campaigns_metrics():
    """Get metrics for all campaigns"""
    try:
        metrics_list = analytics_tracking_service.get_all_campaigns_metrics()
        
        return [
            CampaignMetricsResponse(
                campaign_id=metrics.campaign_id,
                total_sent=metrics.total_sent,
                total_delivered=metrics.total_delivered,
                total_opened=metrics.total_opened,
                total_replied=metrics.total_replied,
                total_positive=metrics.total_positive,
                total_meetings=metrics.total_meetings,
                open_rate=metrics.open_rate,
                reply_rate=metrics.reply_rate,
                positive_rate=metrics.positive_rate,
                meeting_rate=metrics.meeting_rate,
                alignment_score=metrics.alignment_score,
                cost_per_lead=metrics.cost_per_lead,
                cost_per_meeting=metrics.cost_per_meeting,
                roi=metrics.roi
            )
            for metrics in metrics_list
        ]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting all campaigns metrics: {str(e)}")


@router.post("/calculate-alignment-correlation", response_model=AlignmentCorrelationResponse)
async def calculate_alignment_correlation(campaign_id: str):
    """Calculate alignment correlation for a campaign"""
    try:
        correlation = analytics_tracking_service.calculate_alignment_correlation(campaign_id)
        
        if not correlation:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return AlignmentCorrelationResponse(
            alignment_score=correlation.alignment_score,
            open_rate=correlation.open_rate,
            reply_rate=correlation.reply_rate,
            positive_rate=correlation.positive_rate,
            correlation_coefficient=correlation.correlation_coefficient,
            sample_size=correlation.sample_size
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating alignment correlation: {str(e)}")


@router.get("/performance-insights/{campaign_id}", response_model=List[PerformanceInsightResponse])
async def get_performance_insights(campaign_id: str):
    """Get performance insights for a campaign"""
    try:
        insights = analytics_tracking_service.generate_performance_insights(campaign_id)
        
        return [
            PerformanceInsightResponse(
                metric=insight.metric,
                value=insight.value,
                trend=insight.trend,
                change_percentage=insight.change_percentage,
                recommendation=insight.recommendation,
                priority=insight.priority
            )
            for insight in insights
        ]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting performance insights: {str(e)}")


@router.post("/calculate-roi")
async def calculate_roi(request: ROICalculationRequest):
    """Calculate ROI for a campaign"""
    try:
        roi = analytics_tracking_service.calculate_roi(
            campaign_id=request.campaign_id,
            revenue_generated=request.revenue_generated,
            costs=request.costs
        )
        
        return {"roi": roi, "message": "ROI calculated successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating ROI: {str(e)}")


@router.get("/benchmark-metrics")
async def get_benchmark_metrics():
    """Get benchmark metrics for comparison"""
    try:
        benchmarks = analytics_tracking_service.get_benchmark_metrics()
        return {"benchmarks": benchmarks}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting benchmark metrics: {str(e)}")


@router.get("/trend-analysis/{campaign_id}", response_model=TrendAnalysisResponse)
async def get_trend_analysis(campaign_id: str, days: int = 30):
    """Get trend analysis for a campaign"""
    try:
        analysis = analytics_tracking_service.get_trend_analysis(campaign_id, days)
        
        if not analysis:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return TrendAnalysisResponse(
            campaign_id=analysis["campaign_id"],
            current_metrics=analysis["current_metrics"],
            benchmark_comparison=analysis["benchmark_comparison"],
            performance_grade=analysis["performance_grade"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting trend analysis: {str(e)}")


@router.get("/export-analytics-data")
async def export_analytics_data(campaign_id: Optional[str] = None):
    """Export analytics data for reporting"""
    try:
        data = analytics_tracking_service.export_analytics_data(campaign_id)
        return data
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting analytics data: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "analytics-tracking"}
