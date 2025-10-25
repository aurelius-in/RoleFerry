"""
Analytics Tracking Service for RoleFerry
Handles analytics tracking, metrics calculation, and insights generation
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
import statistics


@dataclass
class CampaignMetrics:
    """Represents campaign metrics"""
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


@dataclass
class AlignmentCorrelation:
    """Represents alignment score correlation with performance"""
    alignment_score: float
    open_rate: float
    reply_rate: float
    positive_rate: float
    correlation_coefficient: float
    sample_size: int


@dataclass
class PerformanceInsight:
    """Represents a performance insight"""
    metric: str
    value: float
    trend: str  # "up", "down", "stable"
    change_percentage: float
    recommendation: str
    priority: str  # "high", "medium", "low"


class AnalyticsTrackingService:
    """Service for analytics tracking and insights"""
    
    def __init__(self):
        self.metrics_db: Dict[str, CampaignMetrics] = {}
        self.alignment_correlations: List[AlignmentCorrelation] = []
        self.performance_insights: List[PerformanceInsight] = []
    
    def track_email_sent(self, campaign_id: str, email_id: str, recipient: str, 
                        alignment_score: float, timestamp: datetime = None) -> None:
        """Track when an email is sent"""
        if timestamp is None:
            timestamp = datetime.now()
        
        # Initialize campaign metrics if not exists
        if campaign_id not in self.metrics_db:
            self.metrics_db[campaign_id] = CampaignMetrics(
                campaign_id=campaign_id,
                total_sent=0,
                total_delivered=0,
                total_opened=0,
                total_replied=0,
                total_positive=0,
                total_meetings=0,
                open_rate=0.0,
                reply_rate=0.0,
                positive_rate=0.0,
                meeting_rate=0.0,
                alignment_score=alignment_score,
                cost_per_lead=0.0,
                cost_per_meeting=0.0,
                roi=0.0
            )
        
        # Update metrics
        self.metrics_db[campaign_id].total_sent += 1
    
    def track_email_delivered(self, campaign_id: str, email_id: str, timestamp: datetime = None) -> None:
        """Track when an email is delivered"""
        if timestamp is None:
            timestamp = datetime.now()
        
        if campaign_id in self.metrics_db:
            self.metrics_db[campaign_id].total_delivered += 1
            self._update_rates(campaign_id)
    
    def track_email_opened(self, campaign_id: str, email_id: str, timestamp: datetime = None) -> None:
        """Track when an email is opened"""
        if timestamp is None:
            timestamp = datetime.now()
        
        if campaign_id in self.metrics_db:
            self.metrics_db[campaign_id].total_opened += 1
            self._update_rates(campaign_id)
    
    def track_email_replied(self, campaign_id: str, email_id: str, 
                           reply_type: str = "positive", timestamp: datetime = None) -> None:
        """Track when an email receives a reply"""
        if timestamp is None:
            timestamp = datetime.now()
        
        if campaign_id in self.metrics_db:
            self.metrics_db[campaign_id].total_replied += 1
            
            if reply_type == "positive":
                self.metrics_db[campaign_id].total_positive += 1
            
            self._update_rates(campaign_id)
    
    def track_meeting_scheduled(self, campaign_id: str, email_id: str, timestamp: datetime = None) -> None:
        """Track when a meeting is scheduled"""
        if timestamp is None:
            timestamp = datetime.now()
        
        if campaign_id in self.metrics_db:
            self.metrics_db[campaign_id].total_meetings += 1
            self._update_rates(campaign_id)
    
    def _update_rates(self, campaign_id: str) -> None:
        """Update all rates for a campaign"""
        if campaign_id not in self.metrics_db:
            return
        
        metrics = self.metrics_db[campaign_id]
        
        # Calculate rates
        if metrics.total_sent > 0:
            metrics.open_rate = metrics.total_opened / metrics.total_sent
            metrics.reply_rate = metrics.total_replied / metrics.total_sent
            metrics.positive_rate = metrics.total_positive / metrics.total_sent
            metrics.meeting_rate = metrics.total_meetings / metrics.total_sent
    
    def calculate_alignment_correlation(self, campaign_id: str) -> AlignmentCorrelation:
        """Calculate correlation between alignment score and performance"""
        if campaign_id not in self.metrics_db:
            return None
        
        metrics = self.metrics_db[campaign_id]
        
        # Calculate correlation coefficient
        correlation = self._calculate_correlation(
            metrics.alignment_score,
            metrics.open_rate,
            metrics.reply_rate,
            metrics.positive_rate
        )
        
        correlation_data = AlignmentCorrelation(
            alignment_score=metrics.alignment_score,
            open_rate=metrics.open_rate,
            reply_rate=metrics.reply_rate,
            positive_rate=metrics.positive_rate,
            correlation_coefficient=correlation,
            sample_size=metrics.total_sent
        )
        
        self.alignment_correlations.append(correlation_data)
        return correlation_data
    
    def _calculate_correlation(self, alignment_score: float, open_rate: float, 
                              reply_rate: float, positive_rate: float) -> float:
        """Calculate correlation coefficient between alignment score and performance"""
        # Simple correlation calculation
        # In a real implementation, you'd use more sophisticated statistical methods
        
        if alignment_score == 0:
            return 0.0
        
        # Weighted average of performance metrics
        performance_score = (open_rate * 0.3 + reply_rate * 0.4 + positive_rate * 0.3)
        
        # Simple correlation approximation
        correlation = min(1.0, max(-1.0, (alignment_score - 0.5) * (performance_score - 0.5) * 4))
        
        return correlation
    
    def generate_performance_insights(self, campaign_id: str) -> List[PerformanceInsight]:
        """Generate performance insights for a campaign"""
        if campaign_id not in self.metrics_db:
            return []
        
        metrics = self.metrics_db[campaign_id]
        insights = []
        
        # Open rate insights
        if metrics.open_rate < 0.20:
            insights.append(PerformanceInsight(
                metric="Open Rate",
                value=metrics.open_rate,
                trend="down",
                change_percentage=-20.0,
                recommendation="Improve subject lines and sender reputation",
                priority="high"
            ))
        elif metrics.open_rate > 0.40:
            insights.append(PerformanceInsight(
                metric="Open Rate",
                value=metrics.open_rate,
                trend="up",
                change_percentage=20.0,
                recommendation="Maintain current subject line strategy",
                priority="low"
            ))
        
        # Reply rate insights
        if metrics.reply_rate < 0.05:
            insights.append(PerformanceInsight(
                metric="Reply Rate",
                value=metrics.reply_rate,
                trend="down",
                change_percentage=-30.0,
                recommendation="Improve email content and personalization",
                priority="high"
            ))
        elif metrics.reply_rate > 0.15:
            insights.append(PerformanceInsight(
                metric="Reply Rate",
                value=metrics.reply_rate,
                trend="up",
                change_percentage=30.0,
                recommendation="Scale successful messaging patterns",
                priority="low"
            ))
        
        # Alignment score insights
        if metrics.alignment_score < 0.70:
            insights.append(PerformanceInsight(
                metric="Alignment Score",
                value=metrics.alignment_score,
                trend="down",
                change_percentage=-15.0,
                recommendation="Improve targeting and pain point identification",
                priority="high"
            ))
        elif metrics.alignment_score > 0.90:
            insights.append(PerformanceInsight(
                metric="Alignment Score",
                value=metrics.alignment_score,
                trend="up",
                change_percentage=15.0,
                recommendation="Maintain high-quality targeting",
                priority="low"
            ))
        
        # Cost per lead insights
        if metrics.cost_per_lead > 50.0:
            insights.append(PerformanceInsight(
                metric="Cost Per Lead",
                value=metrics.cost_per_lead,
                trend="up",
                change_percentage=25.0,
                recommendation="Optimize targeting to reduce costs",
                priority="high"
            ))
        elif metrics.cost_per_lead < 20.0:
            insights.append(PerformanceInsight(
                metric="Cost Per Lead",
                value=metrics.cost_per_lead,
                trend="down",
                change_percentage=-25.0,
                recommendation="Scale successful campaigns",
                priority="low"
            ))
        
        self.performance_insights.extend(insights)
        return insights
    
    def get_campaign_metrics(self, campaign_id: str) -> Optional[CampaignMetrics]:
        """Get metrics for a specific campaign"""
        return self.metrics_db.get(campaign_id)
    
    def get_all_campaigns_metrics(self) -> List[CampaignMetrics]:
        """Get metrics for all campaigns"""
        return list(self.metrics_db.values())
    
    def get_alignment_correlations(self) -> List[AlignmentCorrelation]:
        """Get all alignment correlations"""
        return self.alignment_correlations
    
    def get_performance_insights(self, campaign_id: Optional[str] = None) -> List[PerformanceInsight]:
        """Get performance insights"""
        if campaign_id:
            return [insight for insight in self.performance_insights 
                   if insight.metric in ["Open Rate", "Reply Rate", "Alignment Score", "Cost Per Lead"]]
        return self.performance_insights
    
    def calculate_roi(self, campaign_id: str, revenue_generated: float, costs: float) -> float:
        """Calculate ROI for a campaign"""
        if campaign_id not in self.metrics_db:
            return 0.0
        
        if costs == 0:
            return 0.0
        
        roi = ((revenue_generated - costs) / costs) * 100
        self.metrics_db[campaign_id].roi = roi
        return roi
    
    def get_benchmark_metrics(self) -> Dict[str, float]:
        """Get benchmark metrics for comparison"""
        return {
            "average_open_rate": 0.25,
            "average_reply_rate": 0.08,
            "average_positive_rate": 0.05,
            "average_meeting_rate": 0.03,
            "average_alignment_score": 0.75,
            "average_cost_per_lead": 35.0,
            "average_roi": 150.0
        }
    
    def get_trend_analysis(self, campaign_id: str, days: int = 30) -> Dict[str, Any]:
        """Get trend analysis for a campaign"""
        if campaign_id not in self.metrics_db:
            return {}
        
        metrics = self.metrics_db[campaign_id]
        benchmarks = self.get_benchmark_metrics()
        
        return {
            "campaign_id": campaign_id,
            "current_metrics": {
                "open_rate": metrics.open_rate,
                "reply_rate": metrics.reply_rate,
                "positive_rate": metrics.positive_rate,
                "meeting_rate": metrics.meeting_rate,
                "alignment_score": metrics.alignment_score
            },
            "benchmark_comparison": {
                "open_rate": metrics.open_rate - benchmarks["average_open_rate"],
                "reply_rate": metrics.reply_rate - benchmarks["average_reply_rate"],
                "positive_rate": metrics.positive_rate - benchmarks["average_positive_rate"],
                "meeting_rate": metrics.meeting_rate - benchmarks["average_meeting_rate"],
                "alignment_score": metrics.alignment_score - benchmarks["average_alignment_score"]
            },
            "performance_grade": self._calculate_performance_grade(metrics, benchmarks)
        }
    
    def _calculate_performance_grade(self, metrics: CampaignMetrics, benchmarks: Dict[str, float]) -> str:
        """Calculate performance grade for a campaign"""
        score = 0
        
        # Open rate grade
        if metrics.open_rate > benchmarks["average_open_rate"] * 1.2:
            score += 25
        elif metrics.open_rate > benchmarks["average_open_rate"]:
            score += 15
        elif metrics.open_rate > benchmarks["average_open_rate"] * 0.8:
            score += 10
        
        # Reply rate grade
        if metrics.reply_rate > benchmarks["average_reply_rate"] * 1.2:
            score += 25
        elif metrics.reply_rate > benchmarks["average_reply_rate"]:
            score += 15
        elif metrics.reply_rate > benchmarks["average_reply_rate"] * 0.8:
            score += 10
        
        # Alignment score grade
        if metrics.alignment_score > benchmarks["average_alignment_score"] * 1.1:
            score += 25
        elif metrics.alignment_score > benchmarks["average_alignment_score"]:
            score += 15
        elif metrics.alignment_score > benchmarks["average_alignment_score"] * 0.9:
            score += 10
        
        # ROI grade
        if metrics.roi > benchmarks["average_roi"] * 1.2:
            score += 25
        elif metrics.roi > benchmarks["average_roi"]:
            score += 15
        elif metrics.roi > benchmarks["average_roi"] * 0.8:
            score += 10
        
        if score >= 90:
            return "A+"
        elif score >= 80:
            return "A"
        elif score >= 70:
            return "B"
        elif score >= 60:
            return "C"
        else:
            return "D"
    
    def export_analytics_data(self, campaign_id: Optional[str] = None) -> Dict[str, Any]:
        """Export analytics data for reporting"""
        data = {
            "export_timestamp": datetime.now().isoformat(),
            "campaigns": [],
            "alignment_correlations": [],
            "performance_insights": [],
            "benchmarks": self.get_benchmark_metrics()
        }
        
        if campaign_id:
            if campaign_id in self.metrics_db:
                data["campaigns"].append(self.metrics_db[campaign_id].__dict__)
        else:
            data["campaigns"] = [metrics.__dict__ for metrics in self.metrics_db.values()]
        
        data["alignment_correlations"] = [corr.__dict__ for corr in self.alignment_correlations]
        data["performance_insights"] = [insight.__dict__ for insight in self.performance_insights]
        
        return data


# Global instance
analytics_tracking_service = AnalyticsTrackingService()
