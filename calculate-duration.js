export const getDurationString = (start, finish) => {
  const startDate = new Date(start);
  const finishDate = new Date(finish);

  let years = finishDate.getFullYear() - startDate.getFullYear();
  let months = finishDate.getMonth() - startDate.getMonth();
  let days = finishDate.getDate() - startDate.getDate();
  let hours = finishDate.getHours() - startDate.getHours();
  let minutes = finishDate.getMinutes() - startDate.getMinutes();
  let seconds = finishDate.getSeconds() - startDate.getSeconds();

  if (seconds < 0) {
    seconds += 60;
    minutes--;
  }
  if (minutes < 0) {
    minutes += 60;
    hours--;
  }
  if (hours < 0) {
    hours += 24;
    days--;
  }
  if (days < 0) {
    const previousMonth = new Date(finishDate.getFullYear(), finishDate.getMonth(), 0);
    days += previousMonth.getDate();
    months--;
  }
  if (months < 0) {
    months += 12;
    years--;
  }

  const duration = `P${years}Y${months}M${days}DT${hours}H${minutes}M${seconds}S`;
  return duration;
}