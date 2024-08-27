import * as fs from "fs"
import * as WEBIFC from "web-ifc"
import { transformCsv } from "./transform-csv.js"
import {getDurationString} from "./calculate-duration.js"



  // Is important to know the IFC data type to be used in each entity attribute.
   // In the case of the Name attribute, the IFC data type is IfcLabel.
  // You can know the data types by looking at the specific IFC entity documentation.
// We're using the file system API to read the schedule.csv as an string
const csvData = fs.readFileSync("./src/schedule.csv", { encoding: "utf-8" })
// Then, the CSV string is converted into the object shown in the picture above
const data = transformCsv(csvData)

// Export the data object to a JSON file
const jsonData = JSON.stringify(data, null, 2) // Pretty print with 2 spaces
fs.writeFileSync("./src/data.json", jsonData, { encoding: "utf-8" })

const IFC = new WEBIFC.IfcAPI()
await IFC.Init()
const inputIfc = fs.readFileSync("./ifc-files/K-P_4.ifc")
const modelID = IFC.OpenModel(inputIfc)

// Most entities need a reference to the global IfcOwnerHistory entity.
// This function gives the reference to it using the WEBIFC.Handle.
const getOwnerHistoryHandle = () => {
  const ids = IFC.GetLineIDsWithType(modelID, WEBIFC.IFCOWNERHISTORY)
  // As there is supposed to be just one IfcOwnerHistory, we can safely take the first element.
  const ownerHistoryID = ids.get(0)
  if (ownerHistoryID) return new WEBIFC.Handle(ownerHistoryID)
  return null
}

// This is doing the same as the getOwnerHistoryHandle function,
// just that it gives a reference to the IfcProject entity in the file
const getProjectHandle = () => {
  const ids = IFC.GetLineIDsWithType(modelID, WEBIFC.IFCPROJECT)
  const projectID = ids.get(0)
  if (projectID) return new WEBIFC.Handle(projectID)
  return null
}


// Along the exercise, many new entities will be created inside the IFC file.
// Most entities in the schema requires a GUID.
// This function just creates a random IfcGloballyUniqueId to be used in new entities.
const newGUID = () => {
  return new WEBIFC.IFC4X3.IfcGloballyUniqueId(crypto.randomUUID())
}

const newExpressID = () => {
  return IFC.GetMaxExpressID(modelID) + 1

}


// New entities created must be explicitly save inside the IFC file.
// This function takes an entity, gives it a new expressID based on the last found
// and then writes the information inside the file.
const saveEntity = (entity) => {
  entity.expressID = newExpressID()
  IFC.WriteLine(modelID, entity)
}

// The input data is just one row from the converted CSV information.
// Take a look at the video for more context about this.
const newTask = (data) => {

  const { Name, Description, Identification, Start, Finish, Time } = data;

    const name = Name ? new WEBIFC.IFC4X3.IfcLabel(Name) : null
    const description = Description ? new WEBIFC.IFC4X3.IfcText(Description) : null
    const identification = Identification ? new WEBIFC.IFC4X3.IfcIdentifier(Identification) : null
    const taskTimeAttrb = Time ? new WEBIFC.Handle(Time.expressID) : null

    const task = new WEBIFC.IFC4X3.IfcTask(
      newGUID(),
      getOwnerHistoryHandle(),
      name,
      description,
      null,
      identification,
      null,
      null,
      null,
      new WEBIFC.IFC4X3.IfcBoolean(false),
      null,
      taskTimeAttrb,
    )
  
    // Here we use the function to save the entity in the file.
    saveEntity(task)

    return task
}



const processTaskData = (task, ifcRel) => {
  // sätter data och underliggande barn till en task
  const { data, children } = task
  // definerar ny variabel baserat på kolumnerna till "data"
  const { ID, Name, Description, Start, Finish } = data

  // taskVariabel
  let taskDuration = null

  if(Start && Finish) {
    const duration =  getDurationString(Start, Finish)
    console.log(duration)
    //  funktionen innehåller variabeln  duration med resultat i format PnYnMnDTnHnMnS (ISO 8601)
    taskDuration = new WEBIFC.IFC4X3.IfcDuration(duration)
    
  }

  const IfcTaskTime  = new WEBIFC.IFC4X3.IfcTaskTime(
    null,
    null,
    null,
    null,
    taskDuration,
    Start? new WEBIFC.IFC4X3.IfcDateTime(Start) : null,
    Finish? new WEBIFC.IFC4X3.IfcDateTime(Finish) : null,
  )
  //5
  saveEntity(IfcTaskTime)
   

//definerar en ny ifc.task med attributerna
// 6
const ifcTask =  newTask({ Name, Description, Identification: ID, Time:  IfcTaskTime })

// Handle kan användas för att ge från en ExpressID till attributvärde i en annan IFC-entity
const taskHandle = new WEBIFC.Handle(ifcTask.expressID)

if (ifcRel) {
  ifcRel.RelatedObjects.push(taskHandle)
  IFC.WriteLine(modelID, ifcRel)
}

//kolla om det finns children (större än 1 task)
if (children && children.length !== 0) {
  const taskNests = new WEBIFC.IFC4X3.IfcRelNests(
    newGUID(),
    null,
    null,
    null,
    taskHandle,
    []
  )
  saveEntity(taskNests)
  
  for (const child of children) {
    processTaskData(child, taskNests)
  }
 } 
}

// Based on the IFC documentation, all first-level tasks must be
// tied together by a "master" task.
// The "master" task is called the summary task.
const summaryTask = newTask({ Name: "Summary" })

// This relation is to hold together all first-level tasks with the
// summary tasks, as denoted by the IFC schema.
const summaryTaskNests = new WEBIFC.IFC4X3.IfcRelNests(
  newGUID(),
  getOwnerHistoryHandle(),
  null,
  null,
  new WEBIFC.Handle(summaryTask.expressID),
  []
)

saveEntity(summaryTaskNests)

// Here is where the real processing starts, as we took the conversion
// from the CSV file into the more workable structure and start to create
// the corresponding IFC data.
for (const task of data) {
  processTaskData(task, summaryTaskNests)
}

// The schedule in the IFC schema is denoted by the IfcWorkSchedule entity.
const schedule = new WEBIFC.IFC4X3.IfcWorkSchedule(
    newGUID(),
    getOwnerHistoryHandle(),
    new WEBIFC.IFC4X3.IfcLabel("Planned Schedule")
  )
  
  saveEntity(schedule)
  
  // A relation of type IfcRelAssignsToControl is needed to tell the schedule
  // controls the summary tasks (and, consequently, all the schedule tasks)
const controlRel = new WEBIFC.IFC4X3.IfcRelAssignsToControl(
    newGUID(),
    getOwnerHistoryHandle(),
    null,
    null,
    [new WEBIFC.Handle(summaryTask.expressID)],
    null,
    new WEBIFC.Handle(schedule.expressID),
    null,
    null,
)
  
  saveEntity(controlRel)

  const projectHandle = getProjectHandle()
  if (projectHandle) {
    const declaresRel = new WEBIFC.IFC4X3.IfcRelDeclares(
      newGUID(),
      getOwnerHistoryHandle(),
      null,
      null,
      projectHandle,
      [new WEBIFC.Handle(schedule.expressID)]
    )

    saveEntity(declaresRel)
  }


  const outputIfc = IFC.SaveModel(modelID)
  fs.writeFileSync("structure_Schedule1.ifc", outputIfc)
